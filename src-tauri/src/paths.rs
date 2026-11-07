//! Пути к данным лаунчера.
//! Конфиг и аккаунты всегда лежат в %APPDATA%/KonMin.
//! Игровые данные (версии, библиотеки, ассеты, рантаймы, сборки) — там же,
//! либо в папке, выбранной в настройках.
//! Раскладка повторяет .minecraft (versions/, libraries/, assets/), чтобы
//! официальные инсталлеры Forge/NeoForge могли ставиться прямо в неё.

use std::path::PathBuf;

pub fn config_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("KonMin")
}

pub fn data_root() -> PathBuf {
    crate::settings::load()
        .data_dir
        .filter(|s| !s.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(config_dir)
}

pub fn versions_dir() -> PathBuf {
    data_root().join("versions")
}
pub fn libraries_dir() -> PathBuf {
    data_root().join("libraries")
}
pub fn assets_dir() -> PathBuf {
    data_root().join("assets")
}
pub fn runtimes_dir() -> PathBuf {
    data_root().join("runtimes")
}
pub fn instances_dir() -> PathBuf {
    data_root().join("instances")
}
pub fn cache_dir() -> PathBuf {
    data_root().join("cache")
}
pub fn skins_dir() -> PathBuf {
    config_dir().join("skins")
}

/// Проверка относительного пути из внешних данных (mrpack и т.п.):
/// запрещаем абсолютные пути и выход за пределы папки через "..".
pub fn safe_join(base: &std::path::Path, rel: &str) -> Option<PathBuf> {
    let rel = rel.replace('\\', "/");
    if rel.starts_with('/') || rel.contains(':') {
        return None;
    }
    let mut out = base.to_path_buf();
    for part in rel.split('/') {
        match part {
            "" | "." => {}
            ".." => return None,
            p => out.push(p),
        }
    }
    Some(out)
}
