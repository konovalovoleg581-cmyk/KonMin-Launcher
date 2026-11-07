//! Аккаунты: Ely.by (Yggdrasil-совместимый authserver) и «Гость» (оффлайн).
//!
//! Документация: https://docs.ely.by/ru/minecraft-auth.html
//! Эндпоинты: https://authserver.ely.by/auth/{authenticate,refresh,validate,invalidate}
//! 2FA: при включённой двухфакторке сервер отвечает 401
//! "Account protected with two factor auth." — тогда пароль отправляется
//! повторно в виде "пароль:код".
//!
//! Токены хранятся в системном хранилище (Windows Credential Manager / Keychain /
//! Secret Service) через crate `keyring`. В accounts.json — только ник и UUID.

use crate::{err, paths, settings};
use anyhow::{anyhow, bail, Result};
use md5::{Digest, Md5};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const AUTH_URL: &str = "https://authserver.ely.by/auth";
const KEYRING_SERVICE: &str = "KonMin Launcher";

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    /// UUID профиля без дефисов
    pub id: String,
    pub name: String,
    /// "ely" | "guest"
    pub kind: String,
    /// Логин (ник/e-mail) для Ely.by — для подсказки при повторном входе
    pub login: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Tokens {
    access_token: String,
    client_token: String,
}

fn accounts_path() -> std::path::PathBuf {
    paths::config_dir().join("accounts.json")
}

pub fn load_accounts() -> Vec<Account> {
    std::fs::read(accounts_path())
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

fn save_accounts(list: &[Account]) -> Result<()> {
    std::fs::create_dir_all(paths::config_dir())?;
    std::fs::write(accounts_path(), serde_json::to_vec_pretty(list)?)?;
    Ok(())
}

fn entry(id: &str) -> Result<keyring::Entry> {
    Ok(keyring::Entry::new(KEYRING_SERVICE, &format!("ely:{id}"))?)
}

fn store_tokens(id: &str, t: &Tokens) -> Result<()> {
    entry(id)?.set_password(&serde_json::to_string(t)?)?;
    Ok(())
}

fn read_tokens(id: &str) -> Result<Tokens> {
    let s = entry(id)?
        .get_password()
        .map_err(|_| anyhow!("Токен не найден в хранилище — войдите в Ely.by снова"))?;
    Ok(serde_json::from_str(&s)?)
}

fn upsert(acc: Account) -> Result<()> {
    let mut list = load_accounts();
    list.retain(|a| a.id != acc.id);
    list.push(acc.clone());
    save_accounts(&list)?;
    let mut s = settings::load();
    s.active_account = Some(acc.id);
    settings::save(&s)?;
    Ok(())
}

/// Оффлайн-UUID как в vanilla-сервере: md5("OfflinePlayer:" + ник), версия 3.
pub fn offline_uuid(name: &str) -> String {
    let mut b: [u8; 16] = Md5::digest(format!("OfflinePlayer:{name}").as_bytes()).into();
    b[6] = (b[6] & 0x0f) | 0x30;
    b[8] = (b[8] & 0x3f) | 0x80;
    hex::encode(b)
}

async fn post(endpoint: &str, body: Value) -> Result<(u16, Value)> {
    let resp = crate::net::client()
        .post(format!("{AUTH_URL}/{endpoint}"))
        .json(&body)
        .send()
        .await
        .map_err(|e| anyhow!("Ely.by недоступен: {e}"))?;
    let status = resp.status().as_u16();
    let text = resp.text().await.unwrap_or_default();
    let v = if text.trim().is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(Value::Null)
    };
    Ok((status, v))
}

fn ely_error(v: &Value) -> String {
    let msg = v["errorMessage"].as_str().unwrap_or("неизвестная ошибка");
    if msg.contains("Invalid credentials") {
        "Неверный логин или пароль".into()
    } else if msg.contains("two factor") {
        "Неверный код двухфакторной аутентификации".into()
    } else {
        format!("Ely.by: {msg}")
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountsState {
    pub accounts: Vec<Account>,
    pub active: Option<String>,
}

#[tauri::command]
pub fn list_accounts() -> AccountsState {
    AccountsState {
        accounts: load_accounts(),
        active: settings::load().active_account,
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginResult {
    /// "ok" | "need2fa"
    pub status: String,
    pub account: Option<Account>,
}

#[tauri::command]
pub async fn ely_login(
    login: String,
    password: String,
    totp: Option<String>,
) -> Result<LoginResult, String> {
    let client_token = settings::load().client_token;
    let pw = match totp.as_deref().map(str::trim) {
        Some(code) if !code.is_empty() => format!("{password}:{code}"),
        _ => password,
    };
    let (status, v) = post(
        "authenticate",
        json!({
            "username": login.trim(),
            "password": pw,
            "clientToken": client_token,
            "requestUser": true
        }),
    )
    .await
    .map_err(err)?;

    if status == 401
        && totp.as_deref().map(|t| t.trim().is_empty()).unwrap_or(true)
        && v["errorMessage"]
            .as_str()
            .map(|m| m.contains("two factor"))
            .unwrap_or(false)
    {
        return Ok(LoginResult {
            status: "need2fa".into(),
            account: None,
        });
    }
    if status != 200 {
        return Err(ely_error(&v));
    }
    let access = v["accessToken"].as_str().ok_or("Ely.by: нет accessToken")?;
    let profile = &v["selectedProfile"];
    let id = profile["id"]
        .as_str()
        .ok_or("Ely.by: у аккаунта нет профиля")?;
    let name = profile["name"].as_str().unwrap_or("Player");
    let acc = Account {
        id: id.replace('-', ""),
        name: name.into(),
        kind: "ely".into(),
        login: Some(login.trim().into()),
    };
    store_tokens(
        &acc.id,
        &Tokens {
            access_token: access.into(),
            client_token: v["clientToken"].as_str().unwrap_or(&client_token).into(),
        },
    )
    .map_err(err)?;
    upsert(acc.clone()).map_err(err)?;
    Ok(LoginResult {
        status: "ok".into(),
        account: Some(acc),
    })
}

#[tauri::command]
pub fn add_guest(name: String) -> Result<Account, String> {
    let name = name.trim().to_string();
    let valid = (3..=16).contains(&name.len())
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
    if !valid {
        return Err("Ник: 3–16 символов, латиница, цифры и _".into());
    }
    let acc = Account {
        id: offline_uuid(&name),
        name,
        kind: "guest".into(),
        login: None,
    };
    upsert(acc.clone()).map_err(err)?;
    Ok(acc)
}

#[tauri::command]
pub fn set_active_account(id: String) -> Result<(), String> {
    if !load_accounts().iter().any(|a| a.id == id) {
        return Err("Аккаунт не найден".into());
    }
    let mut s = settings::load();
    s.active_account = Some(id);
    settings::save(&s).map_err(err)
}

#[tauri::command]
pub async fn logout(id: String) -> Result<(), String> {
    let list = load_accounts();
    if let Some(acc) = list.iter().find(|a| a.id == id) {
        if acc.kind == "ely" {
            if let Ok(t) = read_tokens(&acc.id) {
                let _ = post(
                    "invalidate",
                    json!({"accessToken": t.access_token, "clientToken": t.client_token}),
                )
                .await;
            }
            if let Ok(e) = entry(&acc.id) {
                let _ = e.delete_credential();
            }
        }
    }
    let rest: Vec<Account> = list.into_iter().filter(|a| a.id != id).collect();
    save_accounts(&rest).map_err(err)?;
    let mut s = settings::load();
    if s.active_account.as_deref() == Some(id.as_str()) {
        s.active_account = rest.first().map(|a| a.id.clone());
    }
    settings::save(&s).map_err(err)
}

/// Данные сессии для запуска игры.
pub struct Session {
    pub name: String,
    pub uuid: String,
    pub access_token: String,
    pub user_type: String,
    pub is_ely: bool,
}

/// Текущий активный аккаунт с актуальным токеном (validate → refresh).
pub async fn active_session() -> Result<Session> {
    let s = settings::load();
    let list = load_accounts();
    let acc = s
        .active_account
        .and_then(|id| list.into_iter().find(|a| a.id == id))
        .ok_or_else(|| anyhow!("Сначала войдите в аккаунт (Ely.by или Гость)"))?;
    if acc.kind != "ely" {
        return Ok(Session {
            uuid: acc.id,
            name: acc.name,
            access_token: "0".into(),
            user_type: "legacy".into(),
            is_ely: false,
        });
    }
    let mut t = read_tokens(&acc.id)?;
    let (st, _) = post("validate", json!({"accessToken": t.access_token})).await?;
    if st != 200 {
        let (st, v) = post(
            "refresh",
            json!({
                "accessToken": t.access_token,
                "clientToken": t.client_token,
                "requestUser": false
            }),
        )
        .await?;
        if st != 200 {
            bail!("Сессия Ely.by истекла — войдите в аккаунт снова");
        }
        t.access_token = v["accessToken"]
            .as_str()
            .ok_or_else(|| anyhow!("Ely.by: пустой ответ refresh"))?
            .into();
        store_tokens(&acc.id, &t)?;
    }
    Ok(Session {
        uuid: acc.id,
        name: acc.name,
        access_token: t.access_token,
        user_type: "mojang".into(),
        is_ely: true,
    })
}
