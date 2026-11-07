//! Minecraft: Bedrock Edition (Windows).
//! Лаунчер только находит установленный пакет Microsoft Store и запускает его
//! системным способом. Вход — через аккаунт Microsoft/Xbox внутри самой игры;
//! Ely.by и переключение версий Bedrock официально не поддерживаются.

use crate::err;
use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

/// Store ID Minecraft for Windows
const STORE_URL: &str = "ms-windows-store://pdp/?ProductId=9NBLGGH2JHXJ";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BedrockStatus {
    /// Поддерживается ли Bedrock на этой ОС
    pub supported: bool,
    pub installed: bool,
    pub version: Option<String>,
}

#[cfg(windows)]
fn query_package() -> Option<String> {
    use std::os::windows::process::CommandExt;
    let out = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "(Get-AppxPackage -Name Microsoft.MinecraftUWP | Select-Object -First 1).Version",
        ])
        .creation_flags(0x0800_0000)
        .output()
        .ok()?;
    let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
    (!v.is_empty()).then_some(v)
}

#[tauri::command]
pub async fn bedrock_status() -> BedrockStatus {
    #[cfg(windows)]
    {
        let v = tokio::task::spawn_blocking(query_package)
            .await
            .ok()
            .flatten();
        BedrockStatus {
            supported: true,
            installed: v.is_some(),
            version: v,
        }
    }
    #[cfg(not(windows))]
    {
        BedrockStatus {
            supported: false,
            installed: false,
            version: None,
        }
    }
}

#[tauri::command]
pub fn launch_bedrock(app: AppHandle) -> Result<(), String> {
    if !cfg!(windows) {
        return Err("Bedrock Edition доступна только на Windows".into());
    }
    // Протокол minecraft: зарегистрирован пакетом игры (UWP и GDK-версии).
    app.opener()
        .open_url("minecraft:", None::<&str>)
        .map_err(err)
}

#[tauri::command]
pub fn open_bedrock_store(app: AppHandle) -> Result<(), String> {
    app.opener().open_url(STORE_URL, None::<&str>).map_err(err)
}
