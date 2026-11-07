//! Запуск Minecraft: Java Edition.
//! Порядок: сессия → загрузчик → JSON версии (с наследованием) → Java →
//! библиотеки/натив/client.jar → ассеты → logging → authlib-injector → аргументы → процесс.

use crate::{auth, err, instances, java, loaders, net, paths, settings, versions};
use anyhow::{anyhow, bail, Result};
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;

const AUTHLIB_META: &str = "https://authlib-injector.yushi.moe/artifact/latest.json";
const RESOURCES_URL: &str = "https://resources.download.minecraft.net";

#[derive(Default)]
pub struct GameState {
    pub running: Arc<Mutex<HashMap<String, Arc<Mutex<Child>>>>>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LogLine {
    instance_id: String,
    line: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GameExit {
    instance_id: String,
    code: Option<i32>,
    crash_report: Option<String>,
    crashed: bool,
}

#[tauri::command]
pub fn running_games(state: State<'_, GameState>) -> Vec<String> {
    state
        .running
        .lock()
        .map(|m| m.keys().cloned().collect())
        .unwrap_or_default()
}

#[tauri::command]
pub fn kill_game(state: State<'_, GameState>, id: String) -> Result<(), String> {
    let child = state.running.lock().ok().and_then(|m| m.get(&id).cloned());
    match child {
        Some(c) => c.lock().map_err(err)?.kill().map_err(err),
        None => Err("Игра не запущена".into()),
    }
}

#[tauri::command]
pub fn open_crash_report(app: AppHandle, path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.starts_with(paths::instances_dir()) {
        return Err("Недопустимый путь".into());
    }
    app.opener().open_path(path, None::<&str>).map_err(err)
}

#[tauri::command]
pub async fn launch_instance(
    app: AppHandle,
    state: State<'_, GameState>,
    id: String,
) -> Result<(), String> {
    let running = state.running.clone();
    if running.lock().map(|m| m.contains_key(&id)).unwrap_or(false) {
        return Err("Эта сборка уже запущена".into());
    }
    let task = format!("launch:{id}");
    match launch(&app, &task, &id, running).await {
        Ok(()) => Ok(()),
        Err(e) => {
            net::emit(&app, &task, "error", &err(&e), 0, 0);
            Err(err(e))
        }
    }
}

fn cp_sep() -> &'static str {
    if cfg!(windows) {
        ";"
    } else {
        ":"
    }
}

async fn ensure_authlib() -> Result<PathBuf> {
    let dir = paths::data_root().join("authlib");
    let path = dir.join("authlib-injector.jar");
    let meta: Result<Value> = net::get_json(AUTHLIB_META).await;
    let meta = match meta {
        Ok(m) => m,
        Err(e) => {
            return if path.exists() { Ok(path) } else { Err(e) };
        }
    };
    let url = meta["download_url"]
        .as_str()
        .ok_or_else(|| anyhow!("authlib-injector: нет download_url"))?;
    let want = meta["checksums"]["sha256"]
        .as_str()
        .unwrap_or("")
        .to_lowercase();
    if let Ok(b) = std::fs::read(&path) {
        if hex::encode(Sha256::digest(&b)) == want {
            return Ok(path);
        }
    }
    if !url.starts_with("https://authlib-injector.yushi.moe/") {
        bail!("authlib-injector: неожиданный источник загрузки");
    }
    let b = net::get_bytes(url).await?;
    if hex::encode(Sha256::digest(&b)) != want {
        bail!("authlib-injector: неверная контрольная сумма");
    }
    std::fs::create_dir_all(&dir)?;
    std::fs::write(&path, &b)?;
    Ok(path)
}

fn extract_natives(jars: &[PathBuf], dest: &Path) -> Result<()> {
    let _ = std::fs::remove_dir_all(dest);
    std::fs::create_dir_all(dest)?;
    for jar in jars {
        let Ok(f) = std::fs::File::open(jar) else {
            continue;
        };
        let Ok(mut z) = zip::ZipArchive::new(f) else {
            continue;
        };
        for i in 0..z.len() {
            let mut e = z.by_index(i)?;
            let name = e.name().to_string();
            if e.is_dir() || name.starts_with("META-INF") {
                continue;
            }
            let lower = name.to_lowercase();
            if !(lower.ends_with(".dll")
                || lower.ends_with(".so")
                || lower.ends_with(".dylib")
                || lower.ends_with(".jnilib"))
            {
                continue;
            }
            let file = name.rsplit('/').next().unwrap_or(&name).to_string();
            let mut buf = Vec::new();
            e.read_to_end(&mut buf)?;
            std::fs::write(dest.join(file), buf)?;
        }
    }
    Ok(())
}

fn subst(s: &str, vars: &HashMap<&str, String>) -> String {
    let mut out = s.to_string();
    for (k, v) in vars {
        out = out.replace(&format!("${{{k}}}"), v);
    }
    out
}

/// Разобрать список аргументов нового формата (строки и объекты с rules).
fn collect_args(list: Option<&Value>, out: &mut Vec<String>) {
    let Some(arr) = list.and_then(|l| l.as_array()) else {
        return;
    };
    for a in arr {
        if let Some(s) = a.as_str() {
            out.push(s.to_string());
        } else if versions::rules_allow(a.get("rules")) {
            match &a["value"] {
                Value::String(s) => out.push(s.clone()),
                Value::Array(vs) => {
                    out.extend(vs.iter().filter_map(|v| v.as_str().map(String::from)))
                }
                _ => {}
            }
        }
    }
}

async fn launch(
    app: &AppHandle,
    task: &str,
    id: &str,
    running: Arc<Mutex<HashMap<String, Arc<Mutex<Child>>>>>,
) -> Result<()> {
    let mut inst = instances::load(id)?;
    let st = settings::load();
    net::emit(app, task, "prepare", "Проверка аккаунта", 0, 1);
    let session = auth::active_session().await?;

    // 1. загрузчик / версия
    let version_id = match &inst.version_id {
        Some(v) if versions::version_json_path(v).exists() => v.clone(),
        _ => {
            net::emit(app, task, "loader", "Подготовка версии", 0, 1);
            let (vid, lv) = loaders::install(
                app,
                task,
                &inst.mc_version,
                &inst.loader,
                inst.loader_version.as_deref(),
            )
            .await?;
            inst.version_id = Some(vid.clone());
            if lv.is_some() {
                inst.loader_version = lv;
            }
            instances::save(&inst)?;
            vid
        }
    };
    let v = versions::resolve(&version_id).await?;
    let main_class = v["mainClass"]
        .as_str()
        .ok_or_else(|| anyhow!("в версии нет mainClass"))?
        .to_string();

    // 2. Java
    let java_bin = java::ensure_java(app, task, &v, inst.java_path.clone()).await?;

    // 3. библиотеки
    let libs_dir = paths::libraries_dir();
    let mut downloads: Vec<net::Download> = Vec::new();
    let mut classpath: Vec<PathBuf> = Vec::new();
    let mut native_jars: Vec<PathBuf> = Vec::new();
    let mut seen = HashSet::new();
    let arch_bits = if cfg!(target_pointer_width = "64") {
        "64"
    } else {
        "32"
    };
    for lib in v["libraries"].as_array().cloned().unwrap_or_default() {
        if !versions::rules_allow(lib.get("rules")) {
            continue;
        }
        let name = lib["name"].as_str().unwrap_or("").to_string();
        let parts: Vec<&str> = name.split(':').collect();
        let key = match parts.len() {
            n if n >= 4 => format!("{}:{}:{}", parts[0], parts[1], parts[3]),
            n if n >= 2 => format!("{}:{}", parts[0], parts[1]),
            _ => name.clone(),
        };
        if !seen.insert(key) {
            continue;
        }
        let is_native = parts
            .get(3)
            .map(|c| c.starts_with("natives-"))
            .unwrap_or(false);
        let artifact = &lib["downloads"]["artifact"];
        if artifact.is_object() {
            let rel = artifact["path"]
                .as_str()
                .map(String::from)
                .or_else(|| net::maven_path(&name));
            if let Some(rel) = rel {
                let full = libs_dir.join(&rel);
                let url = artifact["url"].as_str().unwrap_or("");
                if !url.is_empty() {
                    let mut d = net::Download::new(
                        url,
                        full.clone(),
                        artifact["sha1"].as_str().map(String::from),
                    );
                    d.size = artifact["size"].as_u64();
                    downloads.push(d);
                }
                if is_native {
                    native_jars.push(full.clone());
                }
                classpath.push(full);
            }
        } else if lib.get("natives").is_none() {
            // maven-стиль (Fabric, Quilt, старый Forge)
            if let Some(rel) = net::maven_path(&name) {
                let full = libs_dir.join(&rel);
                let base = lib["url"]
                    .as_str()
                    .unwrap_or("https://libraries.minecraft.net/")
                    .trim_end_matches('/');
                downloads.push(net::Download::new(
                    format!("{base}/{rel}"),
                    full.clone(),
                    lib["sha1"].as_str().map(String::from),
                ));
                classpath.push(full);
            }
        }
        // старый формат натив-библиотек (LWJGL 2 и т.п.)
        if let Some(cls) = lib["natives"][versions::os_name()].as_str() {
            let cls = cls.replace("${arch}", arch_bits);
            let c = &lib["downloads"]["classifiers"][cls.as_str()];
            if let (Some(rel), Some(url)) = (c["path"].as_str(), c["url"].as_str()) {
                let full = libs_dir.join(rel);
                let mut d =
                    net::Download::new(url, full.clone(), c["sha1"].as_str().map(String::from));
                d.size = c["size"].as_u64();
                downloads.push(d);
                native_jars.push(full);
            }
        }
    }

    // 4. client.jar (ванильный jar базовой версии)
    let jar_id = v["jar"]
        .as_str()
        .or_else(|| v["inheritsFrom"].as_str())
        .unwrap_or(&version_id)
        .to_string();
    let client_jar = paths::versions_dir()
        .join(&jar_id)
        .join(format!("{jar_id}.jar"));
    if let Some(c) = v["downloads"]["client"].as_object() {
        let mut d = net::Download::new(
            c["url"].as_str().unwrap_or_default(),
            client_jar.clone(),
            c["sha1"].as_str().map(String::from),
        );
        d.size = c["size"].as_u64();
        downloads.push(d);
    }
    classpath.push(client_jar);

    // 5. logging config
    let mut logging_arg: Option<String> = None;
    let lc = &v["logging"]["client"];
    if let (Some(arg), Some(fid), Some(url)) = (
        lc["argument"].as_str(),
        lc["file"]["id"].as_str(),
        lc["file"]["url"].as_str(),
    ) {
        let p = paths::assets_dir().join("log_configs").join(fid);
        downloads.push(net::Download::new(
            url,
            p.clone(),
            lc["file"]["sha1"].as_str().map(String::from),
        ));
        logging_arg = Some(arg.replace("${path}", &p.to_string_lossy()));
    }
    net::download_all(app, task, "libraries", "Загрузка библиотек", downloads).await?;

    // 6. ассеты
    let assets_root = paths::assets_dir();
    let ai = &v["assetIndex"];
    let index_id = ai["id"]
        .as_str()
        .or_else(|| v["assets"].as_str())
        .unwrap_or("legacy")
        .to_string();
    let index_path = assets_root.join("indexes").join(format!("{index_id}.json"));
    if let Some(url) = ai["url"].as_str() {
        net::download_one(&net::Download::new(
            url,
            index_path.clone(),
            ai["sha1"].as_str().map(String::from),
        ))
        .await?;
    }
    let index: Value = std::fs::read(&index_path)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or(Value::Null);
    let mut asset_dl = Vec::new();
    let mut seen_hash = HashSet::new();
    if let Some(objs) = index["objects"].as_object() {
        for o in objs.values() {
            let Some(hash) = o["hash"].as_str() else {
                continue;
            };
            if hash.len() < 2 || !seen_hash.insert(hash.to_string()) {
                continue;
            }
            let pre = &hash[..2];
            let mut d = net::Download::new(
                format!("{RESOURCES_URL}/{pre}/{hash}"),
                assets_root.join("objects").join(pre).join(hash),
                Some(hash.to_string()),
            );
            d.size = o["size"].as_u64();
            d.verify_existing = false; // имя файла = хеш, проверяем размер
            asset_dl.push(d);
        }
    }
    net::download_all(app, task, "assets", "Загрузка ассетов", asset_dl).await?;

    let game_dir = instances::game_dir(id);
    std::fs::create_dir_all(&game_dir)?;
    // старые версии: virtual / map_to_resources
    let is_virtual = index["virtual"].as_bool().unwrap_or(false);
    let map_res = index["map_to_resources"].as_bool().unwrap_or(false);
    let virtual_dir = assets_root.join("virtual").join(&index_id);
    if is_virtual || map_res {
        let target = if map_res {
            game_dir.join("resources")
        } else {
            virtual_dir.clone()
        };
        if let Some(objs) = index["objects"].as_object() {
            for (name, o) in objs {
                let Some(hash) = o["hash"].as_str().filter(|h| h.len() >= 2) else {
                    continue;
                };
                let Some(dst) = paths::safe_join(&target, name) else {
                    continue;
                };
                if dst.exists() {
                    continue;
                }
                if let Some(p) = dst.parent() {
                    std::fs::create_dir_all(p)?;
                }
                let _ = std::fs::copy(assets_root.join("objects").join(&hash[..2]).join(hash), dst);
            }
        }
    }

    // 7. натив
    let natives_dir = instances::dir(id).join("natives");
    extract_natives(&native_jars, &natives_dir)?;

    // 8. authlib-injector для Ely.by
    let authlib = if session.is_ely {
        net::emit(app, task, "authlib", "Подготовка authlib-injector", 0, 1);
        Some(ensure_authlib().await?)
    } else {
        None
    };

    // 9. аргументы
    let cp_string = classpath
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join(cp_sep());
    let mut vars: HashMap<&str, String> = HashMap::new();
    vars.insert("auth_player_name", session.name.clone());
    vars.insert("version_name", version_id.clone());
    vars.insert("game_directory", game_dir.to_string_lossy().to_string());
    vars.insert("assets_root", assets_root.to_string_lossy().to_string());
    let game_assets: PathBuf = if map_res {
        game_dir.join("resources")
    } else if is_virtual {
        virtual_dir.clone()
    } else {
        assets_root.clone()
    };
    vars.insert("game_assets", game_assets.to_string_lossy().to_string());
    vars.insert("assets_index_name", index_id.clone());
    vars.insert("auth_uuid", session.uuid.clone());
    vars.insert("auth_access_token", session.access_token.clone());
    vars.insert(
        "auth_session",
        format!("token:{}:{}", session.access_token, session.uuid),
    );
    vars.insert("user_type", session.user_type.clone());
    vars.insert("version_type", "KonMin".into());
    vars.insert("user_properties", "{}".into());
    vars.insert("clientid", String::new());
    vars.insert("auth_xuid", String::new());
    vars.insert("launcher_name", "KonMin-Launcher".into());
    vars.insert("launcher_version", env!("CARGO_PKG_VERSION").into());
    vars.insert(
        "natives_directory",
        natives_dir.to_string_lossy().to_string(),
    );
    vars.insert("classpath", cp_string);
    vars.insert("classpath_separator", cp_sep().into());
    vars.insert("library_directory", libs_dir.to_string_lossy().to_string());

    let ram = inst.ram_mb.unwrap_or(st.ram_mb).max(512);
    let mut args: Vec<String> = vec![format!("-Xmx{ram}M"), format!("-Xms{}M", ram.min(1024))];
    if let Some(a) = &authlib {
        args.push(format!("-javaagent:{}=ely.by", a.to_string_lossy()));
    }
    args.extend(inst.jvm_args.split_whitespace().map(String::from));
    let mut jvm = Vec::new();
    if v["arguments"]["jvm"].is_array() {
        collect_args(v["arguments"].get("jvm"), &mut jvm);
    } else {
        jvm.push("-Djava.library.path=${natives_directory}".into());
        if cfg!(target_os = "macos") {
            jvm.push("-XstartOnFirstThread".into());
        }
        jvm.push("-cp".into());
        jvm.push("${classpath}".into());
    }
    args.extend(jvm.iter().map(|a| subst(a, &vars)));
    if let Some(l) = logging_arg {
        args.push(l);
    }
    args.push(main_class);
    let mut game = Vec::new();
    if v["arguments"]["game"].is_array() {
        collect_args(v["arguments"].get("game"), &mut game);
    } else if let Some(s) = v["minecraftArguments"].as_str() {
        game.extend(s.split_whitespace().map(String::from));
    }
    args.extend(game.iter().map(|a| subst(a, &vars)));

    // 10. запуск процесса
    net::emit(app, task, "starting", "Запуск игры", 1, 1);
    let mut cmd = Command::new(&java_bin);
    cmd.args(&args)
        .current_dir(&game_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    let started = SystemTime::now();
    let mut child = cmd
        .spawn()
        .map_err(|e| anyhow!("не удалось запустить Java: {e}"))?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let child = Arc::new(Mutex::new(child));
    running
        .lock()
        .map_err(|_| anyhow!("lock"))?
        .insert(id.to_string(), child.clone());

    inst.last_played = Some(instances::now());
    let _ = instances::save(&inst);

    let token = session.access_token.clone();
    for stream in [
        stdout.map(|s| Box::new(s) as Box<dyn Read + Send>),
        stderr.map(|s| Box::new(s) as Box<dyn Read + Send>),
    ]
    .into_iter()
    .flatten()
    {
        let app = app.clone();
        let iid = id.to_string();
        let token = token.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stream).lines().map_while(Result::ok) {
                // никогда не показываем токен в логах
                let line = if token.len() > 4 {
                    line.replace(&token, "***")
                } else {
                    line
                };
                let _ = app.emit(
                    "game-log",
                    LogLine {
                        instance_id: iid.clone(),
                        line,
                    },
                );
            }
        });
    }

    let window = app.get_webview_window("main");
    let mode = st.after_launch.clone();
    if let Some(w) = &window {
        match mode.as_str() {
            "minimize" => {
                let _ = w.minimize();
            }
            "close" => {
                let _ = w.hide();
            }
            _ => {}
        }
    }
    net::emit(app, task, "running", "Запущено", 1, 1);

    // ожидание завершения
    let app2 = app.clone();
    let iid = id.to_string();
    let gd = game_dir.clone();
    std::thread::spawn(move || {
        let code = loop {
            let status = child
                .lock()
                .ok()
                .and_then(|mut c| c.try_wait().ok().flatten());
            if let Some(s) = status {
                break s.code();
            }
            std::thread::sleep(Duration::from_millis(500));
        };
        if let Ok(mut m) = running.lock() {
            m.remove(&iid);
        }
        let crash = find_crash_report(&gd, started);
        let crashed = code.map(|c| c != 0).unwrap_or(true) || crash.is_some();
        let _ = app2.emit(
            "game-exit",
            GameExit {
                instance_id: iid.clone(),
                code,
                crash_report: crash,
                crashed,
            },
        );
        net::emit(
            &app2,
            &format!("launch:{iid}"),
            "exited",
            "Игра закрыта",
            0,
            0,
        );
        if mode == "close" && !crashed {
            app2.exit(0);
        } else if let Some(w) = app2.get_webview_window("main") {
            let _ = w.show();
            let _ = w.unminimize();
            let _ = w.set_focus();
        }
    });
    Ok(())
}

fn find_crash_report(game_dir: &Path, since: SystemTime) -> Option<String> {
    let rd = std::fs::read_dir(game_dir.join("crash-reports")).ok()?;
    rd.flatten()
        .filter_map(|e| {
            let m = e.metadata().ok()?.modified().ok()?;
            (m >= since).then(|| (m, e.path()))
        })
        .max_by_key(|(m, _)| *m)
        .map(|(_, p)| p.to_string_lossy().to_string())
}
