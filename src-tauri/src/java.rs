//! Java-рантаймы: автоматическая загрузка из официального манифеста Mojang
//! (тот же, что использует официальный лаунчер) по полю javaVersion.component.

use crate::{net, paths, settings};
use anyhow::{anyhow, bail, Result};
use serde_json::Value;
use std::path::PathBuf;
use tauri::AppHandle;

const RUNTIME_MANIFEST: &str = "https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json";

fn platform_key() -> &'static str {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => "windows-x64",
        ("windows", "aarch64") => "windows-arm64",
        ("windows", _) => "windows-x86",
        ("macos", "aarch64") => "mac-os-arm64",
        ("macos", _) => "mac-os",
        ("linux", "x86") => "linux-i386",
        _ => "linux",
    }
}

fn java_bin(root: &std::path::Path) -> PathBuf {
    if cfg!(target_os = "windows") {
        root.join("bin").join("javaw.exe")
    } else if cfg!(target_os = "macos") {
        root.join("jre.bundle/Contents/Home/bin/java")
    } else {
        root.join("bin").join("java")
    }
}

/// Вернуть путь к java для версии. Учитывает свою Java из настроек/сборки.
pub async fn ensure_java(
    app: &AppHandle,
    task: &str,
    version_json: &Value,
    custom: Option<String>,
) -> Result<PathBuf> {
    let custom = custom
        .or_else(|| settings::load().java_path)
        .filter(|s| !s.trim().is_empty());
    if let Some(p) = custom {
        let p = PathBuf::from(p);
        if !p.exists() {
            bail!("Указанная Java не найдена: {}", p.display());
        }
        return Ok(p);
    }
    let component = version_json["javaVersion"]["component"]
        .as_str()
        .unwrap_or("jre-legacy")
        .to_string();
    let root = paths::runtimes_dir().join(&component);
    let bin = java_bin(&root);
    let marker = root.join(".konmin-complete");
    if bin.exists() && marker.exists() {
        return Ok(bin);
    }

    net::emit(
        app,
        task,
        "java",
        &format!("Загрузка Java ({component})"),
        0,
        1,
    );
    let all: Value = net::get_json(RUNTIME_MANIFEST).await?;
    let entry = all[platform_key()][&component]
        .as_array()
        .and_then(|a| a.first())
        .ok_or_else(|| {
            anyhow!(
                "Mojang не предоставляет Java «{component}» для этой платформы. Укажите свою Java в настройках."
            )
        })?;
    let url = entry["manifest"]["url"]
        .as_str()
        .ok_or_else(|| anyhow!("нет URL манифеста Java"))?;
    let files: Value = net::get_json(url).await?;
    let mut items = Vec::new();
    if let Some(map) = files["files"].as_object() {
        for (rel, f) in map {
            let Some(target) = paths::safe_join(&root, rel) else {
                continue;
            };
            match f["type"].as_str() {
                Some("directory") => {
                    std::fs::create_dir_all(&target)?;
                }
                Some("file") => {
                    let raw = &f["downloads"]["raw"];
                    let Some(u) = raw["url"].as_str() else {
                        continue;
                    };
                    let mut d =
                        net::Download::new(u, target, raw["sha1"].as_str().map(String::from));
                    d.size = raw["size"].as_u64();
                    d.executable = f["executable"].as_bool().unwrap_or(false);
                    items.push(d);
                }
                // симлинки (macOS) создаются ниже
                _ => {}
            }
        }
    }
    net::download_all(
        app,
        task,
        "java",
        &format!("Загрузка Java ({component})"),
        items,
    )
    .await?;

    #[cfg(unix)]
    if let Some(map) = files["files"].as_object() {
        for (rel, f) in map {
            if f["type"].as_str() == Some("link") {
                if let (Some(target), Some(dst)) =
                    (f["target"].as_str(), paths::safe_join(&root, rel))
                {
                    let _ = std::os::unix::fs::symlink(target, dst);
                }
            }
        }
    }

    if !bin.exists() {
        bail!(
            "Java скачана, но исполняемый файл не найден: {}",
            bin.display()
        );
    }
    std::fs::write(&marker, b"ok")?;
    Ok(bin)
}

/// Java для внутренних задач (инсталлеры Forge/NeoForge) — консольная java.exe.
pub fn console_java(javaw: &std::path::Path) -> PathBuf {
    if cfg!(target_os = "windows") {
        let p = javaw.with_file_name("java.exe");
        if p.exists() {
            return p;
        }
    }
    javaw.to_path_buf()
}
