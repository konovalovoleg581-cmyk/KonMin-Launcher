//! Версии Minecraft: манифест Mojang, JSON версий, наследование (inheritsFrom),
//! правила (rules) под ОС.
//! Формат номера версии не разбирается (поддерживаются 1.x.y, 26.x, снапшоты и т.д.) —
//! всё берётся из манифеста как есть.

use crate::{err, net, paths};
use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

pub const MANIFEST_URL: &str = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ManifestVersion {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub url: String,
    pub release_time: String,
    #[serde(default)]
    pub sha1: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Manifest {
    pub latest: Value,
    pub versions: Vec<ManifestVersion>,
}

pub async fn manifest() -> Result<Manifest> {
    let cache = paths::cache_dir().join("version_manifest_v2.json");
    match net::get_bytes(MANIFEST_URL).await {
        Ok(b) => {
            let m: Manifest = serde_json::from_slice(&b)?;
            let _ = std::fs::create_dir_all(paths::cache_dir());
            let _ = std::fs::write(&cache, &b);
            Ok(m)
        }
        Err(e) => {
            // оффлайн — берём кеш
            let b = std::fs::read(&cache).map_err(|_| e)?;
            Ok(serde_json::from_slice(&b)?)
        }
    }
}

#[tauri::command]
pub async fn get_version_manifest() -> Result<Manifest, String> {
    manifest().await.map_err(err)
}

pub fn version_json_path(id: &str) -> std::path::PathBuf {
    paths::versions_dir().join(id).join(format!("{id}.json"))
}

/// Убедиться, что JSON ванильной версии скачан. Возвращает его.
pub async fn ensure_vanilla_json(id: &str) -> Result<Value> {
    let path = version_json_path(id);
    if let Ok(b) = std::fs::read(&path) {
        if let Ok(v) = serde_json::from_slice::<Value>(&b) {
            return Ok(v);
        }
    }
    let m = manifest().await?;
    let mv = m
        .versions
        .iter()
        .find(|v| v.id == id)
        .ok_or_else(|| anyhow!("Версия {id} не найдена в манифесте Mojang"))?;
    let d = net::Download::new(
        mv.url.clone(),
        path.clone(),
        (!mv.sha1.is_empty()).then(|| mv.sha1.clone()),
    );
    net::download_one(&d).await?;
    let b = std::fs::read(&path)?;
    Ok(serde_json::from_slice(&b)?)
}

pub fn read_version_json(id: &str) -> Result<Value> {
    let b = std::fs::read(version_json_path(id))
        .with_context(|| format!("не найден JSON версии {id}"))?;
    Ok(serde_json::from_slice(&b)?)
}

/// Загрузить версию со всей цепочкой inheritsFrom и слить в один JSON.
pub async fn resolve(id: &str) -> Result<Value> {
    let mut chain: Vec<Value> = Vec::new();
    let mut cur = id.to_string();
    for _ in 0..8 {
        let v = match read_version_json(&cur) {
            Ok(v) => v,
            Err(_) => ensure_vanilla_json(&cur).await?,
        };
        let parent = v["inheritsFrom"].as_str().map(String::from);
        chain.push(v);
        match parent {
            Some(p) => cur = p,
            None => break,
        }
    }
    // chain[0] — дочерняя, последняя — ванильная. Сливаем от родителя к ребёнку.
    let mut merged = chain
        .pop()
        .ok_or_else(|| anyhow!("пустая цепочка версий"))?;
    while let Some(child) = chain.pop() {
        merged = merge(merged, child);
    }
    Ok(merged)
}

fn merge(parent: Value, child: Value) -> Value {
    let mut out: Map<String, Value> = parent.as_object().cloned().unwrap_or_default();
    let c = child.as_object().cloned().unwrap_or_default();
    for (k, v) in c {
        match k.as_str() {
            "libraries" => {
                // библиотеки ребёнка идут первыми (имеют приоритет при дедупликации)
                let mut libs = v.as_array().cloned().unwrap_or_default();
                libs.extend(
                    out.get("libraries")
                        .and_then(|x| x.as_array())
                        .cloned()
                        .unwrap_or_default(),
                );
                out.insert(k, Value::Array(libs));
            }
            "arguments" => {
                let mut args = out
                    .get("arguments")
                    .cloned()
                    .unwrap_or(Value::Object(Map::new()));
                for key in ["game", "jvm"] {
                    let mut list = args[key].as_array().cloned().unwrap_or_default();
                    list.extend(v[key].as_array().cloned().unwrap_or_default());
                    args[key] = Value::Array(list);
                }
                out.insert(k, args);
            }
            _ => {
                out.insert(k, v);
            }
        }
    }
    Value::Object(out)
}

pub fn os_name() -> &'static str {
    match std::env::consts::OS {
        "windows" => "windows",
        "macos" => "osx",
        _ => "linux",
    }
}

/// Проверка "rules" Mojang. Фичи (демо, кастомное разрешение, quickPlay) выключены.
pub fn rules_allow(rules: Option<&Value>) -> bool {
    let Some(rules) = rules.and_then(|r| r.as_array()) else {
        return true;
    };
    let mut allowed = false;
    for r in rules {
        let action = r["action"].as_str() == Some("allow");
        let mut applies = true;
        if let Some(os) = r.get("os") {
            if let Some(name) = os["name"].as_str() {
                if name != os_name() {
                    applies = false;
                }
            }
            if let Some(arch) = os["arch"].as_str() {
                let is_x86 = std::env::consts::ARCH == "x86";
                if arch == "x86" && !is_x86 {
                    applies = false;
                }
            }
        }
        if let Some(f) = r.get("features").and_then(|f| f.as_object()) {
            // все фичи считаем выключенными
            if f.values().any(|v| v.as_bool() == Some(true)) {
                applies = false;
            }
        }
        if applies {
            allowed = action;
        }
    }
    allowed
}
