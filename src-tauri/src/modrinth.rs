//! Modrinth API v2: поиск/проекты/версии (через бэкенд — чтобы задавать
//! User-Agent, кешировать и соблюдать rate limit), установка модов с
//! зависимостями, установка и импорт .mrpack, проверка обновлений по хешам.

use crate::instances::{self, ContentMeta, Instance, ModpackRef, NewInstance};
use crate::{err, net, paths};
use anyhow::{anyhow, bail, Context, Result};
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, State};

pub const API: &str = "https://api.modrinth.com/v2";
const CACHE_TTL: Duration = Duration::from_secs(300);

#[derive(Default)]
pub struct Cache {
    map: Mutex<HashMap<String, (Instant, Value)>>,
}

fn allowed_path(p: &str) -> bool {
    !p.contains("..")
        && [
            "/search",
            "/project/",
            "/projects",
            "/version/",
            "/versions",
            "/tag/",
            "/team/",
        ]
        .iter()
        .any(|a| p.starts_with(a))
}

async fn send_with_retry(req: impl Fn() -> reqwest::RequestBuilder) -> Result<Value> {
    let mut last = anyhow!("Modrinth недоступен");
    for attempt in 0..4u32 {
        match req().send().await {
            Ok(r) if r.status().is_success() => return Ok(r.json::<Value>().await?),
            Ok(r) if r.status().as_u16() == 429 => {
                let wait = r
                    .headers()
                    .get("x-ratelimit-reset")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(10);
                last = anyhow!("лимит запросов Modrinth, повтор через {wait} c");
                tokio::time::sleep(Duration::from_secs(wait.min(60))).await;
                continue;
            }
            Ok(r) if r.status().as_u16() == 404 => bail!("Modrinth: не найдено"),
            Ok(r) => last = anyhow!("Modrinth ответил {}", r.status()),
            Err(e) => last = anyhow!("Нет соединения с Modrinth: {e}"),
        }
        tokio::time::sleep(Duration::from_millis(600 * (attempt as u64 + 1))).await;
    }
    Err(last)
}

pub async fn get(path: &str, query: &[(String, String)]) -> Result<Value> {
    let url = format!("{API}{path}");
    send_with_retry(|| net::client().get(&url).query(query)).await
}

pub async fn post_json(path: &str, body: Value) -> Result<Value> {
    let url = format!("{API}{path}");
    send_with_retry(|| net::client().post(&url).json(&body)).await
}

#[tauri::command]
pub async fn modrinth_get(
    cache: State<'_, Cache>,
    path: String,
    query: Option<Vec<(String, String)>>,
) -> Result<Value, String> {
    if !allowed_path(&path) {
        return Err("Недопустимый запрос к Modrinth".into());
    }
    let q = query.unwrap_or_default();
    let key = format!("{path}?{q:?}");
    if let Some((t, v)) = cache.map.lock().ok().and_then(|m| m.get(&key).cloned()) {
        if t.elapsed() < CACHE_TTL {
            return Ok(v);
        }
    }
    let v = get(&path, &q).await.map_err(err)?;
    if let Ok(mut m) = cache.map.lock() {
        if m.len() > 500 {
            m.clear();
        }
        m.insert(key, (Instant::now(), v.clone()));
    }
    Ok(v)
}

fn content_dir(project_type: &str) -> Result<&'static str> {
    Ok(match project_type {
        "mod" => "mods",
        "resourcepack" => "resourcepacks",
        "shader" => "shaderpacks",
        "datapack" => "datapacks",
        "modpack" => bail!("Это модпак — установите его как новую сборку"),
        "plugin" => {
            bail!("Плагины предназначены для серверов (Paper/Spigot) и не ставятся в клиент")
        }
        other => bail!("Тип «{other}» не поддерживается"),
    })
}

fn instance_loaders(inst: &Instance) -> Vec<String> {
    match inst.loader.as_str() {
        "quilt" => vec!["quilt".into(), "fabric".into()],
        "vanilla" => vec![],
        l => vec![l.into()],
    }
}

async fn pick_version(project_id: &str, project_type: &str, inst: &Instance) -> Result<Value> {
    let mut q = vec![(
        "game_versions".to_string(),
        serde_json::to_string(&[&inst.mc_version])?,
    )];
    if project_type == "mod" {
        let l = instance_loaders(inst);
        if l.is_empty() {
            bail!("Моды требуют загрузчик (Fabric/Forge/NeoForge/Quilt), а сборка — Vanilla");
        }
        q.push(("loaders".into(), serde_json::to_string(&l)?));
    }
    let list = get(&format!("/project/{project_id}/version"), &q).await?;
    list.as_array()
        .and_then(|a| a.first().cloned())
        .ok_or_else(|| {
            anyhow!(
                "Нет совместимой версии для Minecraft {} ({})",
                inst.mc_version,
                inst.loader
            )
        })
}

fn primary_file(version: &Value) -> Option<&Value> {
    let files = version["files"].as_array()?;
    files
        .iter()
        .find(|f| f["primary"].as_bool() == Some(true))
        .or_else(|| files.first())
}

fn check_cdn(url: &str) -> Result<()> {
    const OK: [&str; 4] = [
        "https://cdn.modrinth.com/",
        "https://github.com/",
        "https://raw.githubusercontent.com/",
        "https://gitlab.com/",
    ];
    if OK.iter().any(|p| url.starts_with(p)) {
        Ok(())
    } else {
        bail!("Файл с недоверенного домена отклонён: {url}")
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub installed: Vec<String>,
}

#[tauri::command]
pub async fn install_project(
    app: AppHandle,
    instance_id: String,
    project_id: String,
    version_id: Option<String>,
    task_id: String,
) -> Result<InstallResult, String> {
    install_project_inner(&app, &instance_id, &project_id, version_id, &task_id)
        .await
        .map_err(|e| {
            net::emit(&app, &task_id, "error", &err(&e), 0, 0);
            err(e)
        })
}

async fn install_project_inner(
    app: &AppHandle,
    instance_id: &str,
    project_id: &str,
    version_id: Option<String>,
    task: &str,
) -> Result<InstallResult> {
    let inst = instances::load(instance_id)?;
    let gd = instances::game_dir(instance_id);
    let mut content = instances::load_content(instance_id);
    let mut installed = Vec::new();
    let mut visited: HashSet<String> = HashSet::new();
    let mut queue: Vec<(Option<String>, Option<String>, bool)> =
        vec![(Some(project_id.to_string()), version_id, true)];

    while let Some((pid, vid, explicit)) = queue.pop() {
        // версия (если указана)
        let mut version: Option<Value> = None;
        let pid = match (pid, &vid) {
            (Some(p), _) => p,
            (None, Some(v)) => {
                let ver = get(&format!("/version/{v}"), &[]).await?;
                let p = ver["project_id"].as_str().unwrap_or_default().to_string();
                version = Some(ver);
                p
            }
            _ => continue,
        };
        if pid.is_empty() || !visited.insert(pid.clone()) {
            continue;
        }
        let already = content.values().any(|m| m.project_id == pid);
        if already && !explicit {
            continue;
        }
        let project = get(&format!("/project/{pid}"), &[]).await?;
        let ptype = project["project_type"]
            .as_str()
            .unwrap_or("mod")
            .to_string();
        let title = project["title"].as_str().unwrap_or(&pid).to_string();
        net::emit(
            app,
            task,
            "install",
            &format!("Установка: {title}"),
            installed.len() as u64,
            (installed.len() + queue.len() + 1) as u64,
        );
        let dir = content_dir(&ptype)?;
        let version = match (version, vid) {
            (Some(v), _) => v,
            (None, Some(v)) => get(&format!("/version/{v}"), &[]).await?,
            (None, None) => pick_version(&pid, &ptype, &inst).await?,
        };
        let file = primary_file(&version).ok_or_else(|| anyhow!("У версии нет файлов"))?;
        let url = file["url"]
            .as_str()
            .ok_or_else(|| anyhow!("нет URL файла"))?;
        check_cdn(url)?;
        let filename = file["filename"]
            .as_str()
            .unwrap_or("file.jar")
            .replace(['/', '\\'], "_");
        let dest = gd.join(dir).join(&filename);
        net::download_one(&net::Download::new(
            url,
            dest,
            file["hashes"]["sha1"].as_str().map(String::from),
        ))
        .await?;

        // убрать старую версию того же проекта
        let old: Vec<String> = content
            .iter()
            .filter(|(k, m)| m.project_id == pid && **k != format!("{dir}/{filename}"))
            .map(|(k, _)| k.clone())
            .collect();
        for k in old {
            let _ = std::fs::remove_file(gd.join(&k));
            let _ = std::fs::remove_file(gd.join(format!("{k}.disabled")));
            content.remove(&k);
        }
        content.insert(
            format!("{dir}/{filename}"),
            ContentMeta {
                project_id: pid.clone(),
                version_id: version["id"].as_str().unwrap_or_default().into(),
                title: title.clone(),
                icon_url: project["icon_url"].as_str().map(String::from),
            },
        );
        installed.push(title);

        // обязательные зависимости
        if let Some(deps) = version["dependencies"].as_array() {
            for d in deps {
                if d["dependency_type"].as_str() == Some("required") {
                    queue.push((
                        d["project_id"].as_str().map(String::from),
                        d["version_id"].as_str().map(String::from),
                        false,
                    ));
                }
            }
        }
    }
    instances::save_content(instance_id, &content)?;
    net::emit(app, task, "done", "Установлено", 1, 1);
    Ok(InstallResult { installed })
}

#[tauri::command]
pub async fn install_modpack_version(
    app: AppHandle,
    version_id: String,
    task_id: String,
) -> Result<Instance, String> {
    async {
        let version = get(&format!("/version/{version_id}"), &[]).await?;
        let pid = version["project_id"]
            .as_str()
            .unwrap_or_default()
            .to_string();
        let project = get(&format!("/project/{pid}"), &[]).await?;
        let file = primary_file(&version).ok_or_else(|| anyhow!("У версии нет файлов"))?;
        let url = file["url"].as_str().ok_or_else(|| anyhow!("нет URL"))?;
        check_cdn(url)?;
        let path = paths::cache_dir()
            .join("mrpack")
            .join(format!("{version_id}.mrpack"));
        net::emit(&app, &task_id, "download", "Загрузка модпака", 0, 1);
        net::download_one(&net::Download::new(
            url,
            path.clone(),
            file["hashes"]["sha1"].as_str().map(String::from),
        ))
        .await?;
        let mut inst = install_mrpack(
            &app,
            &task_id,
            &path,
            project["title"].as_str().map(String::from),
            project["icon_url"].as_str().map(String::from),
        )
        .await?;
        inst.modpack = Some(ModpackRef {
            project_id: pid,
            version_id: version_id.clone(),
        });
        instances::save(&inst)?;
        Ok::<Instance, anyhow::Error>(inst)
    }
    .await
    .map_err(|e| {
        net::emit(&app, &task_id, "error", &err(&e), 0, 0);
        err(e)
    })
}

#[tauri::command]
pub async fn import_mrpack(
    app: AppHandle,
    path: String,
    task_id: String,
) -> Result<Instance, String> {
    install_mrpack(&app, &task_id, std::path::Path::new(&path), None, None)
        .await
        .map_err(|e| {
            net::emit(&app, &task_id, "error", &err(&e), 0, 0);
            err(e)
        })
}

async fn install_mrpack(
    app: &AppHandle,
    task: &str,
    path: &std::path::Path,
    name: Option<String>,
    icon: Option<String>,
) -> Result<Instance> {
    let f = std::fs::File::open(path).context("не удалось открыть .mrpack")?;
    let mut z = zip::ZipArchive::new(f).context("файл не является .mrpack (zip)")?;
    let index: Value = {
        let mut s = String::new();
        z.by_name("modrinth.index.json")
            .context("в архиве нет modrinth.index.json")?
            .read_to_string(&mut s)?;
        serde_json::from_str(&s)?
    };
    if index["game"].as_str() != Some("minecraft") {
        bail!("Модпак не для Minecraft");
    }
    let deps = &index["dependencies"];
    let mc = deps["minecraft"]
        .as_str()
        .ok_or_else(|| anyhow!("в модпаке не указана версия Minecraft"))?;
    let (loader, lv) = if let Some(v) = deps["fabric-loader"].as_str() {
        ("fabric", Some(v))
    } else if let Some(v) = deps["quilt-loader"].as_str() {
        ("quilt", Some(v))
    } else if let Some(v) = deps["neoforge"].as_str() {
        ("neoforge", Some(v))
    } else if let Some(v) = deps["forge"].as_str() {
        ("forge", Some(v))
    } else {
        ("vanilla", None)
    };
    let inst = instances::create(NewInstance {
        name: name
            .or_else(|| index["name"].as_str().map(String::from))
            .unwrap_or_else(|| "Модпак".into()),
        icon: icon.unwrap_or_else(|| "chest".into()),
        mc_version: mc.into(),
        loader: loader.into(),
        loader_version: lv.map(String::from),
        ram_mb: None,
        jvm_args: String::new(),
        java_path: None,
    })?;
    let gd = instances::game_dir(&inst.id);

    let mut items = Vec::new();
    for f in index["files"].as_array().cloned().unwrap_or_default() {
        if f["env"]["client"].as_str() == Some("unsupported") {
            continue;
        }
        let rel = f["path"].as_str().unwrap_or_default();
        let dest =
            paths::safe_join(&gd, rel).ok_or_else(|| anyhow!("опасный путь в модпаке: {rel}"))?;
        let url = f["downloads"][0]
            .as_str()
            .ok_or_else(|| anyhow!("нет ссылки для {rel}"))?;
        check_cdn(url)?;
        let mut d = net::Download::new(url, dest, f["hashes"]["sha1"].as_str().map(String::from));
        d.size = f["fileSize"].as_u64();
        items.push(d);
    }
    net::download_all(app, task, "files", "Загрузка файлов модпака", items).await?;

    // overrides, затем client-overrides (перекрывают)
    net::emit(app, task, "overrides", "Применение overrides", 0, 1);
    for prefix in ["overrides/", "client-overrides/"] {
        for i in 0..z.len() {
            let mut e = z.by_index(i)?;
            let name = e.name().to_string();
            let Some(rel) = name.strip_prefix(prefix) else {
                continue;
            };
            if rel.is_empty() || e.is_dir() {
                continue;
            }
            let Some(dest) = paths::safe_join(&gd, rel) else {
                continue;
            };
            if let Some(p) = dest.parent() {
                std::fs::create_dir_all(p)?;
            }
            let mut buf = Vec::new();
            e.read_to_end(&mut buf)?;
            std::fs::write(dest, buf)?;
        }
    }
    net::emit(app, task, "done", "Модпак установлен", 1, 1);
    Ok(inst)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub file: String,
    pub title: String,
    pub new_version_id: String,
    pub new_version_name: String,
}

/// Проверка обновлений модов по SHA1 (POST /version_files/update).
#[tauri::command]
pub async fn check_updates(instance_id: String) -> Result<Vec<UpdateInfo>, String> {
    async {
        let inst = instances::load(&instance_id)?;
        let dir = instances::game_dir(&instance_id).join("mods");
        let mut by_hash: HashMap<String, String> = HashMap::new();
        if let Ok(rd) = std::fs::read_dir(&dir) {
            for e in rd.flatten() {
                if e.path().is_file() {
                    if let Some(h) = net::file_sha1(&e.path()) {
                        by_hash.insert(h, e.file_name().to_string_lossy().to_string());
                    }
                }
            }
        }
        if by_hash.is_empty() || inst.loader == "vanilla" {
            return Ok(vec![]);
        }
        let res = post_json(
            "/version_files/update",
            json!({
                "hashes": by_hash.keys().collect::<Vec<_>>(),
                "algorithm": "sha1",
                "loaders": instance_loaders(&inst),
                "game_versions": [inst.mc_version]
            }),
        )
        .await?;
        let content = instances::load_content(&instance_id);
        let mut out = Vec::new();
        if let Some(map) = res.as_object() {
            for (hash, ver) in map {
                let same = ver["files"]
                    .as_array()
                    .map(|fs| {
                        fs.iter()
                            .any(|f| f["hashes"]["sha1"].as_str() == Some(hash.as_str()))
                    })
                    .unwrap_or(true);
                if same {
                    continue;
                }
                let file = by_hash.get(hash).cloned().unwrap_or_default();
                let base = file.trim_end_matches(".disabled");
                out.push(UpdateInfo {
                    title: content
                        .get(&format!("mods/{base}"))
                        .map(|m| m.title.clone())
                        .unwrap_or_else(|| base.to_string()),
                    file,
                    new_version_id: ver["id"].as_str().unwrap_or_default().into(),
                    new_version_name: ver["version_number"].as_str().unwrap_or_default().into(),
                });
            }
        }
        Ok::<_, anyhow::Error>(out)
    }
    .await
    .map_err(err)
}

#[tauri::command]
pub async fn apply_update(
    instance_id: String,
    file: String,
    version_id: String,
) -> Result<(), String> {
    async {
        if file.contains('/') || file.contains('\\') || file.contains("..") {
            bail!("некорректное имя файла");
        }
        let gd = instances::game_dir(&instance_id);
        let version = get(&format!("/version/{version_id}"), &[]).await?;
        let f = primary_file(&version).ok_or_else(|| anyhow!("нет файла"))?;
        let url = f["url"].as_str().ok_or_else(|| anyhow!("нет URL"))?;
        check_cdn(url)?;
        let new_name = f["filename"]
            .as_str()
            .unwrap_or("mod.jar")
            .replace(['/', '\\'], "_");
        net::download_one(&net::Download::new(
            url,
            gd.join("mods").join(&new_name),
            f["hashes"]["sha1"].as_str().map(String::from),
        ))
        .await?;
        if file != new_name {
            let _ = std::fs::remove_file(gd.join("mods").join(&file));
        }
        let mut content = instances::load_content(&instance_id);
        let base = file.trim_end_matches(".disabled").to_string();
        let mut meta = content.remove(&format!("mods/{base}")).unwrap_or_default();
        meta.version_id = version_id.clone();
        if meta.project_id.is_empty() {
            meta.project_id = version["project_id"].as_str().unwrap_or_default().into();
            meta.title = new_name.clone();
        }
        content.insert(format!("mods/{new_name}"), meta);
        instances::save_content(&instance_id, &content)?;
        Ok::<_, anyhow::Error>(())
    }
    .await
    .map_err(err)
}
