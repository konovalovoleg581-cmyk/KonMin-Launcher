//! Сборки (инстансы). Каждая — папка instances/<id>/ с instance.json,
//! content.json (что установлено из Modrinth) и minecraft/ (игровая папка).

use crate::{err, modrinth, net, paths};
use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ModpackRef {
    pub project_id: String,
    pub version_id: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Instance {
    pub id: String,
    pub name: String,
    /// ключ пиксельной иконки ("grass", "diamond", ...) или https-ссылка на картинку
    pub icon: String,
    pub mc_version: String,
    /// "vanilla" | "fabric" | "quilt" | "forge" | "neoforge"
    pub loader: String,
    pub loader_version: Option<String>,
    /// id версии для запуска (заполняется после установки загрузчика)
    pub version_id: Option<String>,
    pub ram_mb: Option<u32>,
    #[serde(default)]
    pub jvm_args: String,
    pub java_path: Option<String>,
    pub created: u64,
    pub last_played: Option<u64>,
    pub modpack: Option<ModpackRef>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewInstance {
    pub name: String,
    pub icon: String,
    pub mc_version: String,
    pub loader: String,
    pub loader_version: Option<String>,
    pub ram_mb: Option<u32>,
    #[serde(default)]
    pub jvm_args: String,
    pub java_path: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct ContentMeta {
    pub project_id: String,
    pub version_id: String,
    pub title: String,
    pub icon_url: Option<String>,
}

pub fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn dir(id: &str) -> PathBuf {
    paths::instances_dir().join(id)
}
pub fn game_dir(id: &str) -> PathBuf {
    dir(id).join("minecraft")
}

fn check_id(id: &str) -> Result<()> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err(anyhow!("некорректный id сборки"));
    }
    Ok(())
}

pub fn load(id: &str) -> Result<Instance> {
    check_id(id)?;
    let b = std::fs::read(dir(id).join("instance.json"))
        .with_context(|| format!("сборка {id} не найдена"))?;
    Ok(serde_json::from_slice(&b)?)
}

pub fn save(i: &Instance) -> Result<()> {
    std::fs::create_dir_all(game_dir(&i.id))?;
    std::fs::write(
        dir(&i.id).join("instance.json"),
        serde_json::to_vec_pretty(i)?,
    )?;
    Ok(())
}

pub fn load_content(id: &str) -> HashMap<String, ContentMeta> {
    std::fs::read(dir(id).join("content.json"))
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

pub fn save_content(id: &str, c: &HashMap<String, ContentMeta>) -> Result<()> {
    std::fs::write(dir(id).join("content.json"), serde_json::to_vec_pretty(c)?)?;
    Ok(())
}

pub fn create(n: NewInstance) -> Result<Instance> {
    let name = n.name.trim();
    let i = Instance {
        id: uuid::Uuid::new_v4().simple().to_string()[..12].to_string(),
        name: if name.is_empty() {
            n.mc_version.clone()
        } else {
            name.chars().take(48).collect()
        },
        icon: n.icon,
        mc_version: n.mc_version,
        loader: n.loader,
        loader_version: n.loader_version.filter(|s| !s.is_empty()),
        version_id: None,
        ram_mb: n.ram_mb,
        jvm_args: n.jvm_args,
        java_path: n.java_path.filter(|s| !s.is_empty()),
        created: now(),
        last_played: None,
        modpack: None,
    };
    save(&i)?;
    for sub in ["mods", "resourcepacks", "shaderpacks", "saves"] {
        let _ = std::fs::create_dir_all(game_dir(&i.id).join(sub));
    }
    Ok(i)
}

#[tauri::command]
pub fn list_instances() -> Vec<Instance> {
    let mut out: Vec<Instance> = std::fs::read_dir(paths::instances_dir())
        .map(|rd| {
            rd.filter_map(|e| e.ok())
                .filter_map(|e| load(&e.file_name().to_string_lossy()).ok())
                .collect()
        })
        .unwrap_or_default();
    out.sort_by(|a, b| {
        b.last_played
            .unwrap_or(b.created)
            .cmp(&a.last_played.unwrap_or(a.created))
    });
    out
}

#[tauri::command]
pub fn create_instance(input: NewInstance) -> Result<Instance, String> {
    create(input).map_err(err)
}

#[tauri::command]
pub fn update_instance(instance: Instance) -> Result<Instance, String> {
    let old = load(&instance.id).map_err(err)?;
    let mut i = instance;
    if old.mc_version != i.mc_version
        || old.loader != i.loader
        || old.loader_version != i.loader_version
    {
        i.version_id = None; // переустановим загрузчик при следующем запуске
    }
    i.created = old.created;
    save(&i).map_err(err)?;
    Ok(i)
}

#[tauri::command]
pub fn delete_instance(id: String) -> Result<(), String> {
    check_id(&id).map_err(err)?;
    std::fs::remove_dir_all(dir(&id)).map_err(err)
}

fn copy_dir(from: &Path, to: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(to)?;
    for e in std::fs::read_dir(from)? {
        let e = e?;
        let p = e.path();
        let t = to.join(e.file_name());
        if e.file_type()?.is_dir() {
            copy_dir(&p, &t)?;
        } else {
            std::fs::copy(&p, &t)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn duplicate_instance(id: String) -> Result<Instance, String> {
    let src = load(&id).map_err(err)?;
    let mut copy = src.clone();
    copy.id = uuid::Uuid::new_v4().simple().to_string()[..12].to_string();
    copy.name = format!("{} (копия)", src.name);
    copy.created = now();
    copy.last_played = None;
    let (from, to) = (dir(&id), dir(&copy.id));
    tokio::task::spawn_blocking(move || copy_dir(&from, &to))
        .await
        .map_err(err)?
        .map_err(err)?;
    save(&copy).map_err(err)?;
    Ok(copy)
}

#[tauri::command]
pub fn open_instance_folder(app: AppHandle, id: String, sub: Option<String>) -> Result<(), String> {
    let mut p = game_dir(&id);
    check_id(&id).map_err(err)?;
    if let Some(s) = sub.filter(|s| !s.is_empty()) {
        p = paths::safe_join(&p, &s).ok_or("некорректный путь")?;
    }
    std::fs::create_dir_all(&p).map_err(err)?;
    app.opener()
        .open_path(p.to_string_lossy().to_string(), None::<&str>)
        .map_err(err)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentFile {
    pub file: String,
    pub enabled: bool,
    pub size: u64,
    pub title: Option<String>,
    pub project_id: Option<String>,
    pub icon_url: Option<String>,
}

fn kind_dir(kind: &str) -> Result<&'static str> {
    Ok(match kind {
        "mods" => "mods",
        "resourcepacks" => "resourcepacks",
        "shaderpacks" => "shaderpacks",
        "datapacks" => "datapacks",
        _ => return Err(anyhow!("неизвестный тип контента")),
    })
}

#[tauri::command]
pub fn list_instance_content(id: String, kind: String) -> Result<Vec<ContentFile>, String> {
    check_id(&id).map_err(err)?;
    let sub = kind_dir(&kind).map_err(err)?;
    let meta = load_content(&id);
    let mut out = Vec::new();
    if let Ok(rd) = std::fs::read_dir(game_dir(&id).join(sub)) {
        for e in rd.flatten() {
            if !e.file_type().map(|t| t.is_file()).unwrap_or(false) {
                continue;
            }
            let file = e.file_name().to_string_lossy().to_string();
            let enabled = !file.ends_with(".disabled");
            let base = file.trim_end_matches(".disabled").to_string();
            let m = meta.get(&format!("{sub}/{base}"));
            out.push(ContentFile {
                size: e.metadata().map(|m| m.len()).unwrap_or(0),
                title: m.map(|m| m.title.clone()),
                project_id: m.map(|m| m.project_id.clone()),
                icon_url: m.and_then(|m| m.icon_url.clone()),
                file,
                enabled,
            });
        }
    }
    out.sort_by(|a, b| a.file.to_lowercase().cmp(&b.file.to_lowercase()));
    Ok(out)
}

fn content_path(id: &str, kind: &str, file: &str) -> Result<PathBuf> {
    check_id(id)?;
    if file.contains('/') || file.contains('\\') || file.contains("..") {
        return Err(anyhow!("некорректное имя файла"));
    }
    Ok(game_dir(id).join(kind_dir(kind)?).join(file))
}

#[tauri::command]
pub fn toggle_content(id: String, kind: String, file: String) -> Result<(), String> {
    let p = content_path(&id, &kind, &file).map_err(err)?;
    let target = if let Some(base) = file.strip_suffix(".disabled") {
        p.with_file_name(base)
    } else {
        p.with_file_name(format!("{file}.disabled"))
    };
    std::fs::rename(p, target).map_err(err)
}

#[tauri::command]
pub fn delete_content(id: String, kind: String, file: String) -> Result<(), String> {
    let p = content_path(&id, &kind, &file).map_err(err)?;
    std::fs::remove_file(p).map_err(err)?;
    let mut meta = load_content(&id);
    meta.remove(&format!(
        "{}/{}",
        kind_dir(&kind).map_err(err)?,
        file.trim_end_matches(".disabled")
    ));
    save_content(&id, &meta).map_err(err)
}

/// Экспорт в .mrpack: файлы, найденные на Modrinth по хешу, идут ссылками,
/// остальные — в overrides/. Конфиги (config/) тоже кладутся в overrides/.
#[tauri::command]
pub async fn export_mrpack(app: AppHandle, id: String) -> Result<String, String> {
    export(&app, &id).await.map_err(err)
}

async fn export(app: &AppHandle, id: &str) -> Result<String> {
    let inst = load(id)?;
    let gd = game_dir(id);
    let task = format!("export:{id}");
    net::emit(app, &task, "export", "Подготовка экспорта", 0, 1);

    // собрать файлы контента
    let mut files: Vec<(String, Vec<u8>)> = Vec::new();
    for sub in ["mods", "resourcepacks", "shaderpacks"] {
        if let Ok(rd) = std::fs::read_dir(gd.join(sub)) {
            for e in rd.flatten() {
                let name = e.file_name().to_string_lossy().to_string();
                if e.path().is_file() && !name.ends_with(".disabled") {
                    files.push((format!("{sub}/{name}"), std::fs::read(e.path())?));
                }
            }
        }
    }
    let hashes: Vec<String> = files.iter().map(|(_, b)| net::sha1_hex(b)).collect();
    let known: Value = if hashes.is_empty() {
        json!({})
    } else {
        modrinth::post_json(
            "/version_files",
            json!({"hashes": &hashes, "algorithm": "sha1"}),
        )
        .await
        .unwrap_or(json!({}))
    };

    let mut index_files = Vec::new();
    let mut overrides: Vec<(String, Vec<u8>)> = Vec::new();
    for ((path, bytes), sha1) in files.into_iter().zip(hashes) {
        let url = known[&sha1]["files"].as_array().and_then(|fs| {
            fs.iter()
                .find(|f| f["hashes"]["sha1"].as_str() == Some(sha1.as_str()))
                .and_then(|f| f["url"].as_str().map(String::from))
        });
        match url {
            Some(u) => index_files.push(json!({
                "path": path,
                "hashes": {"sha1": sha1, "sha512": net::sha512_hex(&bytes)},
                "env": {"client": "required", "server": "required"},
                "downloads": [u],
                "fileSize": bytes.len()
            })),
            None => overrides.push((path, bytes)),
        }
    }
    // конфиги
    fn walk(base: &Path, cur: &Path, out: &mut Vec<(String, Vec<u8>)>) {
        if let Ok(rd) = std::fs::read_dir(cur) {
            for e in rd.flatten() {
                let p = e.path();
                if p.is_dir() {
                    walk(base, &p, out);
                } else if let (Ok(rel), Ok(b)) = (p.strip_prefix(base), std::fs::read(&p)) {
                    out.push((rel.to_string_lossy().replace('\\', "/"), b));
                }
            }
        }
    }
    walk(&gd, &gd.join("config"), &mut overrides);

    let mut deps = serde_json::Map::new();
    deps.insert("minecraft".into(), json!(inst.mc_version));
    if let Some(lv) = &inst.loader_version {
        let key = match inst.loader.as_str() {
            "fabric" => Some("fabric-loader"),
            "quilt" => Some("quilt-loader"),
            "forge" => Some("forge"),
            "neoforge" => Some("neoforge"),
            _ => None,
        };
        if let Some(k) = key {
            deps.insert(k.into(), json!(lv));
        }
    }
    let index = json!({
        "formatVersion": 1,
        "game": "minecraft",
        "versionId": "1.0.0",
        "name": inst.name,
        "summary": "Экспортировано из KonMin Launcher",
        "files": index_files,
        "dependencies": deps
    });

    let safe_name: String = inst
        .name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let out_dir = dirs::download_dir().unwrap_or_else(|| paths::data_root().join("exports"));
    std::fs::create_dir_all(&out_dir)?;
    let out = out_dir.join(format!("{}.mrpack", safe_name.trim()));
    {
        let f = std::fs::File::create(&out)?;
        let mut z = zip::ZipWriter::new(f);
        let opts = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        z.start_file("modrinth.index.json", opts)?;
        z.write_all(&serde_json::to_vec_pretty(&index)?)?;
        for (p, b) in overrides {
            z.start_file(format!("overrides/{p}"), opts)?;
            z.write_all(&b)?;
        }
        z.finish()?;
    }
    net::emit(app, &task, "done", "Экспорт завершён", 1, 1);
    let _ = app.opener().reveal_item_in_dir(&out);
    Ok(out.to_string_lossy().to_string())
}
