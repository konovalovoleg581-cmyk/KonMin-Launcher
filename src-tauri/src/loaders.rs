//! Модлоадеры: Fabric и Quilt — через их meta-API (готовый профиль версии),
//! Forge и NeoForge — через официальные инсталлеры в headless-режиме
//! (`java -jar installer.jar --installClient <папка>`).

use crate::{err, java, net, paths, versions};
use anyhow::{anyhow, bail, Context, Result};
use serde::Serialize;
use serde_json::Value;
use std::io::{BufRead, BufReader, Read};
use std::process::{Command, Stdio};
use tauri::AppHandle;

#[derive(Serialize, Clone)]
pub struct LoaderVersion {
    pub version: String,
    pub stable: bool,
}

#[tauri::command]
pub async fn get_loader_versions(loader: String, mc: String) -> Result<Vec<LoaderVersion>, String> {
    loader_versions(&loader, &mc).await.map_err(err)
}

async fn loader_versions(loader: &str, mc: &str) -> Result<Vec<LoaderVersion>> {
    let mce = urlencoding::encode(mc);
    Ok(match loader {
        "fabric" => {
            let v: Vec<Value> = net::get_json(&format!(
                "https://meta.fabricmc.net/v2/versions/loader/{mce}"
            ))
            .await?;
            v.iter()
                .filter_map(|x| {
                    Some(LoaderVersion {
                        version: x["loader"]["version"].as_str()?.into(),
                        stable: x["loader"]["stable"].as_bool().unwrap_or(false),
                    })
                })
                .collect()
        }
        "quilt" => {
            let v: Vec<Value> = net::get_json(&format!(
                "https://meta.quiltmc.org/v3/versions/loader/{mce}"
            ))
            .await?;
            v.iter()
                .filter_map(|x| {
                    let ver = x["loader"]["version"].as_str()?;
                    Some(LoaderVersion {
                        version: ver.into(),
                        stable: !ver.contains("beta") && !ver.contains("pre"),
                    })
                })
                .collect()
        }
        "forge" => {
            let v: Value = net::get_json(
                "https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json",
            )
            .await?;
            let prefix = format!("{mc}-");
            let mut list: Vec<LoaderVersion> = v[mc]
                .as_array()
                .cloned()
                .unwrap_or_default()
                .iter()
                .filter_map(|x| x.as_str())
                .map(|full| LoaderVersion {
                    version: full.strip_prefix(&prefix).unwrap_or(full).to_string(),
                    stable: true,
                })
                .collect();
            list.reverse();
            list
        }
        "neoforge" => {
            let v: Value = net::get_json(
                "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge",
            )
            .await?;
            let prefix = neoforge_prefix(mc);
            let mut list: Vec<LoaderVersion> = v["versions"]
                .as_array()
                .cloned()
                .unwrap_or_default()
                .iter()
                .filter_map(|x| x.as_str())
                .filter(|s| s.starts_with(&prefix))
                .map(|s| LoaderVersion {
                    version: s.into(),
                    stable: !s.contains("beta") && !s.contains("alpha"),
                })
                .collect();
            list.reverse();
            list
        }
        _ => vec![],
    })
}

/// NeoForge нумерует версии по MC: 1.21.1 → 21.1.x, 1.21 → 21.0.x.
/// Для новой схемы Mojang (26.1 и т.п.) — префикс совпадает с номером MC.
fn neoforge_prefix(mc: &str) -> String {
    if let Some(rest) = mc.strip_prefix("1.") {
        let parts: Vec<&str> = rest.split('.').collect();
        let minor = parts.get(1).copied().unwrap_or("0");
        format!("{}.{}.", parts[0], minor)
    } else {
        format!("{mc}.")
    }
}

/// Установить загрузчик и вернуть id версии для запуска.
pub async fn install(
    app: &AppHandle,
    task: &str,
    mc: &str,
    loader: &str,
    loader_version: Option<&str>,
) -> Result<(String, Option<String>)> {
    if loader == "vanilla" {
        versions::ensure_vanilla_json(mc).await?;
        return Ok((mc.to_string(), None));
    }
    let lv = match loader_version {
        Some(v) if !v.is_empty() => v.to_string(),
        _ => loader_versions(loader, mc)
            .await?
            .into_iter()
            .find(|v| v.stable)
            .map(|v| v.version)
            .ok_or_else(|| anyhow!("Нет версий {loader} для Minecraft {mc}"))?,
    };
    match loader {
        "fabric" | "quilt" => {
            let url = if loader == "fabric" {
                format!(
                    "https://meta.fabricmc.net/v2/versions/loader/{}/{}/profile/json",
                    urlencoding::encode(mc),
                    urlencoding::encode(&lv)
                )
            } else {
                format!(
                    "https://meta.quiltmc.org/v3/versions/loader/{}/{}/profile/json",
                    urlencoding::encode(mc),
                    urlencoding::encode(&lv)
                )
            };
            net::emit(
                app,
                task,
                "loader",
                &format!("Установка {loader} {lv}"),
                0,
                1,
            );
            let profile: Value = net::get_json(&url).await?;
            let id = profile["id"]
                .as_str()
                .ok_or_else(|| anyhow!("профиль {loader} без id"))?
                .to_string();
            let path = versions::version_json_path(&id);
            std::fs::create_dir_all(path.parent().unwrap())?;
            std::fs::write(&path, serde_json::to_vec_pretty(&profile)?)?;
            versions::ensure_vanilla_json(mc).await?;
            Ok((id, Some(lv)))
        }
        "forge" | "neoforge" => {
            let id = install_forge_like(app, task, mc, loader, &lv).await?;
            Ok((id, Some(lv)))
        }
        other => bail!("Неизвестный загрузчик: {other}"),
    }
}

async fn install_forge_like(
    app: &AppHandle,
    task: &str,
    mc: &str,
    loader: &str,
    lv: &str,
) -> Result<String> {
    let marker = paths::versions_dir().join(format!(".konmin-{loader}-{mc}-{lv}.id"));
    if let Ok(id) = std::fs::read_to_string(&marker) {
        if versions::version_json_path(id.trim()).exists() {
            return Ok(id.trim().to_string());
        }
    }
    let root = paths::data_root();
    std::fs::create_dir_all(&root)?;

    // 1. ванильная версия и client.jar (инсталлеру нужны)
    let vanilla = versions::ensure_vanilla_json(mc).await?;
    if let Some(c) = vanilla["downloads"]["client"].as_object() {
        let mut d = net::Download::new(
            c["url"].as_str().unwrap_or_default(),
            paths::versions_dir().join(mc).join(format!("{mc}.jar")),
            c["sha1"].as_str().map(String::from),
        );
        d.size = c["size"].as_u64();
        net::emit(
            app,
            task,
            "loader",
            "Загрузка Minecraft для инсталлера",
            0,
            1,
        );
        net::download_one(&d).await?;
    }
    // 2. инсталлер требует launcher_profiles.json
    let lp = root.join("launcher_profiles.json");
    if !lp.exists() {
        std::fs::write(
            &lp,
            br#"{"profiles":{},"selectedProfile":"","clientToken":""}"#,
        )?;
    }
    // 3. Java
    let javaw = java::ensure_java(app, task, &vanilla, None).await?;
    let java_exe = java::console_java(&javaw);

    // 4. скачать инсталлер + проверить SHA1 из .sha1 рядом на maven
    let url = if loader == "forge" {
        format!("https://maven.minecraftforge.net/net/minecraftforge/forge/{mc}-{lv}/forge-{mc}-{lv}-installer.jar")
    } else {
        format!("https://maven.neoforged.net/releases/net/neoforged/neoforge/{lv}/neoforge-{lv}-installer.jar")
    };
    let sha1 = net::get_bytes(&format!("{url}.sha1"))
        .await
        .ok()
        .and_then(|b| String::from_utf8(b).ok())
        .map(|s| s.split_whitespace().next().unwrap_or("").to_string())
        .filter(|s| s.len() == 40);
    let installer = paths::cache_dir()
        .join("installers")
        .join(format!("{loader}-{mc}-{lv}-installer.jar"));
    net::emit(
        app,
        task,
        "loader",
        &format!("Загрузка инсталлера {loader} {lv}"),
        0,
        1,
    );
    net::download_one(&net::Download::new(url, installer.clone(), sha1)).await?;

    // 5. id версии из install_profile.json
    let id = {
        let f = std::fs::File::open(&installer)?;
        let mut z = zip::ZipArchive::new(f).context("повреждённый инсталлер")?;
        let mut s = String::new();
        z.by_name("install_profile.json")
            .context("в инсталлере нет install_profile.json")?
            .read_to_string(&mut s)?;
        let p: Value = serde_json::from_str(&s)?;
        p["version"]
            .as_str()
            .or_else(|| p["install"]["target"].as_str())
            .ok_or_else(|| anyhow!("не удалось определить id версии из инсталлера"))?
            .to_string()
    };

    // 6. headless-установка
    net::emit(
        app,
        task,
        "loader",
        &format!("Установка {loader} {lv} (может занять пару минут)"),
        0,
        1,
    );
    let app2 = app.clone();
    let task2 = task.to_string();
    let root2 = root.clone();
    let inst2 = installer.clone();
    let status = tokio::task::spawn_blocking(move || -> Result<bool> {
        let mut cmd = Command::new(java_exe);
        cmd.arg("-jar")
            .arg(&inst2)
            .arg("--installClient")
            .arg(&root2)
            .current_dir(inst2.parent().unwrap())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        }
        let mut child = cmd.spawn().context("не удалось запустить инсталлер")?;
        let stderr = child.stderr.take();
        let errs = std::thread::spawn(move || {
            let mut tail = Vec::new();
            if let Some(e) = stderr {
                for line in BufReader::new(e).lines().map_while(Result::ok) {
                    tail.push(line);
                    if tail.len() > 30 {
                        tail.remove(0);
                    }
                }
            }
            tail
        });
        if let Some(out) = child.stdout.take() {
            for line in BufReader::new(out).lines().map_while(Result::ok) {
                let short: String = line.chars().take(120).collect();
                net::emit(&app2, &task2, "loader", &short, 0, 1);
            }
        }
        let ok = child.wait()?.success();
        let tail = errs.join().unwrap_or_default();
        if !ok && !tail.is_empty() {
            bail!("инсталлер завершился с ошибкой:\n{}", tail.join("\n"));
        }
        Ok(ok)
    })
    .await??;

    if !status || !versions::version_json_path(&id).exists() {
        bail!(
            "Инсталлер {loader} не создал версию {id}. Старые версии Forge (до 1.13) могут не поддерживать автоматическую установку."
        );
    }
    std::fs::write(&marker, &id)?;
    Ok(id)
}
