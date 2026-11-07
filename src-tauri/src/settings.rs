//! Настройки лаунчера (settings.json в %APPDATA%/KonMin).

use crate::{err, paths};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    /// Память по умолчанию для сборок, МБ
    pub ram_mb: u32,
    /// Своя Java (путь к java/javaw). None — автоматически.
    pub java_path: Option<String>,
    /// "ru" | "en"
    pub language: String,
    /// "minimize" | "close" | "keep"
    pub after_launch: String,
    /// Своя папка с игровыми данными
    pub data_dir: Option<String>,
    pub selected_instance: Option<String>,
    /// "java" | "bedrock"
    pub game_mode: String,
    /// Идентификатор клиента для Yggdrasil (не секрет)
    pub client_token: String,
    pub active_account: Option<String>,
    pub sound: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            ram_mb: 4096,
            java_path: None,
            language: "ru".into(),
            after_launch: "minimize".into(),
            data_dir: None,
            selected_instance: None,
            game_mode: "java".into(),
            client_token: String::new(),
            active_account: None,
            sound: true,
        }
    }
}

fn path() -> std::path::PathBuf {
    paths::config_dir().join("settings.json")
}

pub fn load() -> Settings {
    let mut s: Settings = std::fs::read(path())
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default();
    if s.client_token.is_empty() {
        s.client_token = uuid::Uuid::new_v4().simple().to_string();
        let _ = save(&s);
    }
    s
}

pub fn save(s: &Settings) -> anyhow::Result<()> {
    std::fs::create_dir_all(paths::config_dir())?;
    std::fs::write(path(), serde_json::to_vec_pretty(s)?)?;
    Ok(())
}

#[tauri::command]
pub fn get_settings() -> Settings {
    load()
}

#[tauri::command]
pub fn save_settings(settings: Settings) -> Result<Settings, String> {
    let mut s = settings;
    // client_token и активный аккаунт не перетираем с фронтенда
    let cur = load();
    s.client_token = cur.client_token;
    if s.active_account.is_none() {
        s.active_account = cur.active_account;
    }
    if s.ram_mb < 512 {
        s.ram_mb = 512;
    }
    save(&s).map_err(err)?;
    Ok(s)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub version: String,
    pub data_dir: String,
}

#[tauri::command]
pub fn system_info() -> SystemInfo {
    SystemInfo {
        os: std::env::consts::OS.into(),
        arch: std::env::consts::ARCH.into(),
        version: env!("CARGO_PKG_VERSION").into(),
        data_dir: paths::data_root().to_string_lossy().into_owned(),
    }
}

/// Открыть ссылку в браузере. Разрешаем только https и ms-windows-store.
#[tauri::command]
pub fn open_url(app: AppHandle, url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("ms-windows-store:")) {
        return Err("Недопустимая ссылка".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(err)
}

#[tauri::command]
pub fn open_data_folder(app: AppHandle) -> Result<(), String> {
    let p = paths::data_root();
    std::fs::create_dir_all(&p).map_err(err)?;
    app.opener()
        .open_path(p.to_string_lossy().to_string(), None::<&str>)
        .map_err(err)
}
