//! Скины.
//! Чтение — через skinsystem Ely.by (`/textures/{nick}` → ссылки на скин и плащ).
//! Публичного API загрузки скина у Ely.by нет, поэтому «Загрузить скин»
//! сохраняет выбранный PNG в «Загрузки» и открывает сайт ely.by, где
//! пользователь загружает файл сам. Картинки отдаём в UI как data: URL
//! (WebGL не может читать текстуры с чужих доменов без CORS).

use crate::{err, net, paths};
use anyhow::{anyhow, bail, Result};
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

const SKINSYSTEM: &str = "http://skinsystem.ely.by";
/// Страница загрузки скина на сайте Ely.by
const ELY_UPLOAD_PAGE: &str = "https://ely.by/skins/add";

fn data_url(png: &[u8]) -> String {
    format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(png)
    )
}

fn png_size(b: &[u8]) -> Option<(u32, u32)> {
    if b.len() < 24 || &b[..8] != b"\x89PNG\r\n\x1a\n" {
        return None;
    }
    let w = u32::from_be_bytes(b[16..20].try_into().ok()?);
    let h = u32::from_be_bytes(b[20..24].try_into().ok()?);
    Some((w, h))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Textures {
    pub skin: Option<String>,
    pub cape: Option<String>,
    pub slim: bool,
}

#[tauri::command]
pub async fn get_ely_textures(nick: String) -> Result<Textures, String> {
    async {
        if !nick.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
            bail!("некорректный ник");
        }
        let resp = net::client()
            .get(format!("{SKINSYSTEM}/textures/{nick}"))
            .send()
            .await?;
        if resp.status().as_u16() == 204 || resp.status().as_u16() == 404 {
            return Ok(Textures {
                skin: None,
                cape: None,
                slim: false,
            });
        }
        let t: Value = resp.json().await.unwrap_or(Value::Null);
        let slim = t["SKIN"]["metadata"]["model"].as_str() == Some("slim");
        let mut out = Textures {
            skin: None,
            cape: None,
            slim,
        };
        if let Some(u) = t["SKIN"]["url"].as_str() {
            out.skin = net::get_bytes(u).await.ok().map(|b| data_url(&b));
        }
        if let Some(u) = t["CAPE"]["url"].as_str() {
            out.cape = net::get_bytes(u).await.ok().map(|b| data_url(&b));
        }
        Ok::<Textures, anyhow::Error>(out)
    }
    .await
    .map_err(err)
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LocalSkin {
    pub id: String,
    pub name: String,
    pub slim: bool,
    #[serde(skip_deserializing, default)]
    pub data_url: String,
}

fn index_path() -> std::path::PathBuf {
    paths::skins_dir().join("skins.json")
}

fn load_index() -> Vec<LocalSkin> {
    std::fs::read(index_path())
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

fn save_index(list: &[LocalSkin]) -> Result<()> {
    std::fs::create_dir_all(paths::skins_dir())?;
    let clean: Vec<LocalSkin> = list
        .iter()
        .map(|s| LocalSkin {
            data_url: String::new(),
            ..s.clone()
        })
        .collect();
    std::fs::write(index_path(), serde_json::to_vec_pretty(&clean)?)?;
    Ok(())
}

#[tauri::command]
pub fn list_local_skins() -> Vec<LocalSkin> {
    load_index()
        .into_iter()
        .filter_map(|mut s| {
            let b = std::fs::read(paths::skins_dir().join(format!("{}.png", s.id))).ok()?;
            s.data_url = data_url(&b);
            Some(s)
        })
        .collect()
}

#[tauri::command]
pub fn import_skin(path: String, name: Option<String>, slim: bool) -> Result<LocalSkin, String> {
    (|| -> Result<LocalSkin> {
        let b = std::fs::read(&path)?;
        match png_size(&b) {
            Some((64, 64)) | Some((64, 32)) | Some((128, 128)) => {}
            Some((w, h)) => bail!("Скин должен быть 64×64 или 64×32 пикселя (у файла {w}×{h})"),
            None => bail!("Это не PNG-файл"),
        }
        let id = uuid::Uuid::new_v4().simple().to_string()[..10].to_string();
        std::fs::create_dir_all(paths::skins_dir())?;
        std::fs::write(paths::skins_dir().join(format!("{id}.png")), &b)?;
        let fname = std::path::Path::new(&path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "Скин".into());
        let skin = LocalSkin {
            id,
            name: name.filter(|n| !n.trim().is_empty()).unwrap_or(fname),
            slim,
            data_url: data_url(&b),
        };
        let mut list = load_index();
        list.push(skin.clone());
        save_index(&list)?;
        Ok(skin)
    })()
    .map_err(err)
}

#[tauri::command]
pub fn delete_local_skin(id: String) -> Result<(), String> {
    if !id.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err("некорректный id".into());
    }
    let _ = std::fs::remove_file(paths::skins_dir().join(format!("{id}.png")));
    let list: Vec<LocalSkin> = load_index().into_iter().filter(|s| s.id != id).collect();
    save_index(&list).map_err(err)
}

/// Подготовить загрузку на Ely.by: копирует PNG в «Загрузки», показывает его
/// в проводнике и открывает страницу загрузки скина на ely.by.
#[tauri::command]
pub fn prepare_ely_upload(app: AppHandle, id: Option<String>) -> Result<Option<String>, String> {
    let mut saved = None;
    if let Some(id) = id.filter(|i| i.chars().all(|c| c.is_ascii_alphanumeric())) {
        let src = paths::skins_dir().join(format!("{id}.png"));
        let dir = dirs::download_dir().ok_or_else(|| err(anyhow!("нет папки «Загрузки»")))?;
        let dst = dir.join(format!("konmin-skin-{id}.png"));
        std::fs::copy(&src, &dst).map_err(err)?;
        let _ = app.opener().reveal_item_in_dir(&dst);
        saved = Some(dst.to_string_lossy().to_string());
    }
    app.opener()
        .open_url(ELY_UPLOAD_PAGE, None::<&str>)
        .map_err(err)?;
    Ok(saved)
}
