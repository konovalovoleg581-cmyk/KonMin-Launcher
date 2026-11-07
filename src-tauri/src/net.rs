//! Сеть: общий HTTP-клиент, ретраи, параллельные загрузки с проверкой хешей
//! и событиями прогресса для UI.

use anyhow::{anyhow, bail, Context, Result};
use futures::{stream, StreamExt};
use serde::{de::DeserializeOwned, Serialize};
use sha1::{Digest, Sha1};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub const USER_AGENT: &str = concat!(
    "KonMin-Launcher/",
    env!("CARGO_PKG_VERSION"),
    " (Minecraft launcher; Tauri)"
);

pub fn client() -> &'static reqwest::Client {
    static C: OnceLock<reqwest::Client> = OnceLock::new();
    C.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(600))
            .build()
            .expect("http client")
    })
}

const ATTEMPTS: u32 = 4;

async fn backoff(attempt: u32) {
    tokio::time::sleep(Duration::from_millis(500 * 2u64.pow(attempt.min(4)))).await;
}

/// GET с ретраями, возвращает тело как байты.
pub async fn get_bytes(url: &str) -> Result<Vec<u8>> {
    let mut last = anyhow!("неизвестная ошибка");
    for attempt in 0..ATTEMPTS {
        match client().get(url).send().await {
            Ok(r) if r.status().is_success() => match r.bytes().await {
                Ok(b) => return Ok(b.to_vec()),
                Err(e) => last = anyhow!(e),
            },
            Ok(r) if r.status().as_u16() == 404 => bail!("файл не найден (404): {url}"),
            Ok(r) if r.status().as_u16() == 429 => {
                let wait = r
                    .headers()
                    .get("x-ratelimit-reset")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(5);
                tokio::time::sleep(Duration::from_secs(wait.min(60))).await;
                last = anyhow!("слишком много запросов (429)");
                continue;
            }
            Ok(r) => last = anyhow!("сервер ответил {}", r.status()),
            Err(e) => last = anyhow!(e),
        }
        backoff(attempt).await;
    }
    Err(last).with_context(|| format!("не удалось загрузить {url}"))
}

pub async fn get_json<T: DeserializeOwned>(url: &str) -> Result<T> {
    let b = get_bytes(url).await?;
    serde_json::from_slice(&b).with_context(|| format!("некорректный JSON от {url}"))
}

pub fn sha1_hex(data: &[u8]) -> String {
    hex::encode(Sha1::digest(data))
}

pub fn sha512_hex(data: &[u8]) -> String {
    use sha2::Sha512;
    hex::encode(Sha512::digest(data))
}

pub fn file_sha1(path: &Path) -> Option<String> {
    std::fs::read(path).ok().map(|b| sha1_hex(&b))
}

#[derive(Clone, Debug)]
pub struct Download {
    pub url: String,
    pub path: PathBuf,
    pub sha1: Option<String>,
    pub size: Option<u64>,
    /// Если файл уже есть — проверять его SHA1 (иначе только размер)
    pub verify_existing: bool,
    /// Сделать файл исполняемым (unix, для Java-рантайма)
    pub executable: bool,
}

impl Download {
    pub fn new(url: impl Into<String>, path: PathBuf, sha1: Option<String>) -> Self {
        Self {
            url: url.into(),
            path,
            sha1,
            size: None,
            verify_existing: true,
            executable: false,
        }
    }
}

fn is_ok_existing(d: &Download) -> bool {
    let Ok(meta) = std::fs::metadata(&d.path) else {
        return false;
    };
    if let Some(size) = d.size {
        if meta.len() != size {
            return false;
        }
    }
    if d.verify_existing {
        if let Some(h) = &d.sha1 {
            return file_sha1(&d.path).map(|x| x.eq_ignore_ascii_case(h)) == Some(true);
        }
    }
    true
}

pub async fn download_one(d: &Download) -> Result<()> {
    if is_ok_existing(d) {
        return Ok(());
    }
    if let Some(parent) = d.path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let mut last = anyhow!("не скачано");
    for attempt in 0..ATTEMPTS {
        match get_bytes(&d.url).await {
            Ok(bytes) => {
                if let Some(h) = &d.sha1 {
                    let got = sha1_hex(&bytes);
                    if !got.eq_ignore_ascii_case(h) {
                        last = anyhow!("неверный SHA1 (ожидался {h}, получен {got})");
                        backoff(attempt).await;
                        continue;
                    }
                }
                let tmp = PathBuf::from(format!("{}.part", d.path.to_string_lossy()));
                tokio::fs::write(&tmp, &bytes).await?;
                tokio::fs::rename(&tmp, &d.path).await?;
                #[cfg(unix)]
                if d.executable {
                    use std::os::unix::fs::PermissionsExt;
                    let _ =
                        std::fs::set_permissions(&d.path, std::fs::Permissions::from_mode(0o755));
                }
                return Ok(());
            }
            Err(e) => {
                last = e;
                // get_bytes уже ретраит; при 404 смысла повторять нет
                if format!("{last}").contains("404") {
                    break;
                }
            }
        }
    }
    Err(last).with_context(|| format!("загрузка {}", d.url))
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    /// идентификатор задачи, например "launch:<id>" или "install:<id>"
    pub task: String,
    pub stage: String,
    pub text: String,
    pub current: u64,
    pub total: u64,
}

pub fn emit(app: &AppHandle, task: &str, stage: &str, text: &str, current: u64, total: u64) {
    let _ = app.emit(
        "progress",
        Progress {
            task: task.into(),
            stage: stage.into(),
            text: text.into(),
            current,
            total,
        },
    );
}

/// Параллельная загрузка списка файлов (16 потоков) с прогрессом.
pub async fn download_all(
    app: &AppHandle,
    task: &str,
    stage: &str,
    text: &str,
    items: Vec<Download>,
) -> Result<()> {
    let total = items.len() as u64;
    if total == 0 {
        return Ok(());
    }
    let done = Arc::new(AtomicU64::new(0));
    emit(app, task, stage, text, 0, total);
    let mut results = stream::iter(items)
        .map(|d| async move { download_one(&d).await })
        .buffer_unordered(16);
    let mut first_err: Option<anyhow::Error> = None;
    while let Some(r) = results.next().await {
        match r {
            Ok(()) => {
                let n = done.fetch_add(1, Ordering::Relaxed) + 1;
                if n == total || n % 8 == 0 {
                    emit(app, task, stage, text, n, total);
                }
            }
            Err(e) => {
                if first_err.is_none() {
                    first_err = Some(e);
                }
            }
        }
    }
    match first_err {
        Some(e) => Err(e),
        None => Ok(()),
    }
}

/// Maven-координаты "group:artifact:version[:classifier][@ext]" → относительный путь.
pub fn maven_path(name: &str) -> Option<String> {
    let (coords, ext) = match name.split_once('@') {
        Some((c, e)) => (c, e),
        None => (name, "jar"),
    };
    let parts: Vec<&str> = coords.split(':').collect();
    if parts.len() < 3 {
        return None;
    }
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    let file = if parts.len() >= 4 {
        format!("{artifact}-{version}-{}.{ext}", parts[3])
    } else {
        format!("{artifact}-{version}.{ext}")
    };
    Some(format!("{group}/{artifact}/{version}/{file}"))
}
