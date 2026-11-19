# Как собрать KonMin Launcher самому

[English version: BUILDING.md](BUILDING.md)

Три команды. Первая сборка — 10–20 минут, смотря какой компьютер. Дальше — быстрее: Rust пересобирает только изменённое.

## 1. Поставь инструменты

<details open>
<summary><b>Windows 10/11</b></summary>

В PowerShell:

```powershell
winget install --id Git.Git -e
winget install --id Oven-sh.Bun -e
winget install --id Rustlang.Rustup -e
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

После установки закрой и открой PowerShell заново — иначе он не увидит `bun` и `cargo`.

В Windows 11 и большинстве поддерживаемых версий Windows 10 WebView2 уже есть.
Если на машине для разработки его нет, [установи Runtime от Microsoft](https://developer.microsoft.com/microsoft-edge/webview2/).
Если Runtime нет, собранный из этого исходного кода установщик Windows скачивает bootstrapper
Microsoft и ставит его (`src-tauri/installer-hooks.nsh`). Сбой на этом шаге установку лаунчера не останавливает.
</details>

<details>
<summary><b>macOS</b></summary>

```bash
xcode-select --install
curl -fsSL https://bun.sh/install | bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```
</details>

<details>
<summary><b>Linux (Debian, Ubuntu, Mint)</b></summary>

```bash
sudo apt-get install -y git curl libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libxdo-dev libasound2-dev libssl-dev build-essential file wget
curl -fsSL https://bun.sh/install | bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Другие дистрибутивы — названия пакетов в [документации Tauri](https://tauri.app/start/prerequisites/#linux).
</details>

## 2. Собери

```bash
cd <папка с исходниками KonMin Launcher>
bun install
bun run tauri build
```

Необязательные настройки сборки (вход через Microsoft, Discord, обновления) описаны в
[README.md](README.md#build-time-configuration). Например, в PowerShell:

```powershell
$env:KONMIN_MS_CLIENT_ID = "<id приложения (клиента) Azure>"
bun run tauri build
```

## 3. Забери результат

| Система | Где лежит |
| --- | --- |
| Windows | `src-tauri\target\release\bundle\nsis\KonMin Launcher_<версия>_x64-setup.exe` |
| macOS | `src-tauri/target/release/bundle/dmg/` и `bundle/macos/KonMin Launcher.app` |
| Linux | `src-tauri/target/release/bundle/`: `deb/`, `rpm/`, `appimage/` |

Запустить прямо из исходников без установки: `bun run tauri dev`.

## Обновления и подпись

KonMin Launcher поставляется **без** канала обновлений и **без** сертификата подписи: в
[`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) пусты `plugins.updater.endpoints` и
`pubkey`, поэтому лаунчер не проверяет обновления. Чтобы выпускать обновления, создайте пару ключей
`bunx tauri signer generate`, впишите **открытый** ключ в `pubkey`, адреса своих `latest.json` — в
`endpoints`, закрытый ключ держите в секретах CI (`TAURI_SIGNING_PRIVATE_KEY`) и собирайте
`bun run build:release`. Неподписанный установщик Windows показывает «Неизвестный издатель».

## Если не собирается

| Ошибка | Что делать |
| --- | --- |
| `linker 'link.exe' not found` | Нет C++ Build Tools. Команда для Windows — в шаге 1 |
| `bun` или `cargo` «не является командой» | Перезапусти терминал после установки |
| `webkit2gtk-4.1 not found` | Не поставлены пакеты Linux из шага 1 |
| Падает сборка `alsa-sys` | Поставь `libasound2-dev` (Linux) |
| AppImage падает на `linuxdeploy` | Собери без него: `bun run tauri build --bundles deb` |
