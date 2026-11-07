# KonMin Launcher

Лаунчер Minecraft на **Tauri 2 (Rust) + React + TypeScript + Vite**.

- Minecraft **Java Edition**: любая версия из манифеста Mojang (включая снапшоты и новую нумерацию вида 26.x), загрузчики **Fabric, Quilt, Forge, NeoForge**.
- Minecraft **Bedrock Edition** (Windows): запуск установленной версии из Microsoft Store.
- Вход через **Ely.by** (с 2FA), несколько аккаунтов, режим **Гость**.
- **Гардероб** с 3D-превью (skinview3d), Steve/Alex, локальная библиотека скинов.
- **Каталог Modrinth**: моды, модпаки, шейдеры, ресурспаки, датапаки, плагины; установка с зависимостями, `.mrpack` импорт/экспорт, обновления по хешам.
- Установщик **NSIS** `KonMin Launcher_x.y.z_x64-setup.exe`, автосборка в **GitHub Actions**.

---

## 1. Архитектура

```
┌──────────── UI (WebView2) ────────────┐        ┌──────────── Rust (Tauri) ─────────────┐
│ React + Zustand                       │ invoke │ auth.rs      Ely.by Yggdrasil + keyring│
│  Лобби · Гардероб · Библиотека ·      │ ─────► │ versions.rs  манифест Mojang, rules    │
│  Каталог · Проект · Настройки         │        │ loaders.rs   Fabric/Quilt/Forge/NeoF.  │
│ skinview3d (3D-скин)                  │ ◄───── │ java.rs      Java-рантаймы Mojang      │
│                                       │ events │ launch.rs    загрузка, classpath, запуск│
│ события: progress / game-log /        │        │ modrinth.rs  API, кеш, mrpack          │
│          game-exit                    │        │ instances.rs сборки, контент, экспорт  │
└───────────────────────────────────────┘        │ bedrock.rs   пакет Store, minecraft:   │
                                                 │ skins.rs     skinsystem Ely.by         │
                                                 │ net.rs       параллельные загрузки,    │
                                                 │              SHA1, ретраи, прогресс    │
                                                 └────────────────────────────────────────┘
```

Все сетевые запросы делает Rust: это позволяет задавать `User-Agent: KonMin-Launcher/<версия>`, кешировать ответы Modrinth, проверять хеши и не упираться в CORS.

### Структура проекта

```
konmin-launcher/
├─ .github/workflows/build.yml     автосборка setup.exe и релизы
├─ index.html, package.json, vite.config.ts, tsconfig.json
├─ src/                            фронтенд
│  ├─ main.tsx, App.tsx, store.ts, styles.css
│  ├─ lib/api.ts                   типы + обёртки invoke
│  ├─ lib/sound.ts
│  ├─ components/                  TitleBar, SkinViewer, PixelIcon, Modal, LoginModal,
│  │                               ProfileMenu, InstanceEditor, ContentManager,
│  │                               InstallDialog, LogPanel, Toasts
│  └─ screens/                     Lobby, Wardrobe, Library, Catalog, ProjectPage,
│                                  Settings, Servers
└─ src-tauri/
   ├─ Cargo.toml, build.rs, tauri.conf.json
   ├─ capabilities/default.json    права окна
   ├─ icons/                       иконки (app-icon.png 1024×1024 + все размеры)
   └─ src/*.rs                     бэкенд
```

### Где лежат данные (`%APPDATA%\KonMin`)

```
KonMin/
├─ settings.json        настройки
├─ accounts.json        ники и UUID (токены — в Windows Credential Manager)
├─ skins/               локальные скины
├─ versions/            JSON и client.jar версий (как в .minecraft)
├─ libraries/           библиотеки
├─ assets/              ассеты, indexes, log_configs
├─ runtimes/            Java от Mojang (java-runtime-delta и т.д.)
├─ authlib/             authlib-injector.jar
├─ cache/               манифест, инсталлеры Forge/NeoForge, mrpack
└─ instances/<id>/
   ├─ instance.json     модель сборки
   ├─ content.json      что установлено из Modrinth
   ├─ natives/
   └─ minecraft/        игровая папка (mods, saves, config, …)
```

Папку игровых данных можно сменить в настройках (конфиг и аккаунты остаются в `%APPDATA%\KonMin`).

### Модель сборки (`instance.json`)

```json
{
  "id": "a1b2c3d4e5f6",
  "name": "Моя сборка",
  "icon": "grass",
  "mcVersion": "1.21.1",
  "loader": "fabric",
  "loaderVersion": "0.16.9",
  "versionId": "fabric-loader-0.16.9-1.21.1",
  "ramMb": 6144,
  "jvmArgs": "-XX:+UseG1GC",
  "javaPath": null,
  "created": 1730900000,
  "lastPlayed": 1730990000,
  "modpack": { "projectId": "…", "versionId": "…" }
}
```

`versionId` заполняется при первом запуске (после установки загрузчика). Если поменять версию или загрузчик в настройках сборки, загрузчик переустановится.

---

## 2. Как это работает и честные ограничения

### Ely.by
- Используется Yggdrasil-совместимый сервер `https://authserver.ely.by/auth/…` (`authenticate`, `refresh`, `validate`, `invalidate`) по документации docs.ely.by.
- **2FA**: если сервер отвечает 401 «Account protected with two factor auth.», лаунчер просит код и повторяет вход с паролем вида `пароль:код` — так рекомендует Ely.by.
- Пароль не сохраняется. `accessToken` хранится в системном хранилище (Windows Credential Manager через crate `keyring`). Токен вырезается из логов игры.
- Перед запуском токен проверяется (`validate`) и при необходимости обновляется (`refresh`).
- При запуске добавляется `-javaagent:authlib-injector.jar=ely.by`. authlib-injector скачивается с официального `authlib-injector.yushi.moe`, проверяется SHA-256.
- **Скины**: читаются через skinsystem Ely.by (`/textures/<ник>`). **Публичного API загрузки скина у Ely.by нет** — кнопка «Загрузить скин» сохраняет выбранный PNG в «Загрузки» и открывает страницу загрузки на ely.by (`ELY_UPLOAD_PAGE` в `src-tauri/src/skins.rs`; если Ely.by поменяет адрес — поправьте эту константу). После смены нажмите «Обновить» в гардеробе.
- **OAuth 2.0 (альтернатива)**: Ely.by сама рекомендует OAuth2 со scope `minecraft_server_session` как более безопасный способ. Для этого нужно зарегистрировать приложение в кабинете разработчика Ely.by (account.ely.by → «Приложения» → тип «Сайт/приложение»), получить `client_id`/`client_secret`, указать redirect URI вида `http://127.0.0.1:<порт>/callback` и scopes `account_info minecraft_server_session offline_access`. Лаунчер поднимает локальный HTTP-сервер, открывает браузер на `https://account.ely.by/oauth2/v1/<client_id>?…`, получает `code` и меняет его на токен (точные адреса и параметры сверяйте с разделом OAuth 2.0 на docs.ely.by). В этой версии реализован вариант по умолчанию (Yggdrasil), потому что OAuth требует регистрации, которую может сделать только владелец проекта.

### Java Edition
- Версии из `piston-meta.mojang.com/mc/game/version_manifest_v2.json`, формат номера не разбирается — работают и `1.21.1`, и `26.1`, и снапшоты.
- Java скачивается из официального манифеста Mojang по полю `javaVersion.component`. Можно указать свою Java глобально или для сборки.
- Fabric/Quilt — готовый профиль из `meta.fabricmc.net` / `meta.quiltmc.org`.
- Forge/NeoForge — официальный инсталлер в headless-режиме `--installClient` (SHA1 инсталлера сверяется с `.sha1` на maven). Ограничение: Forge **до 1.13** может не поддерживать автоматическую установку; NeoForge для 1.20.1 (артефакт `net.neoforged:forge`) в списке не показывается.
- Все файлы проверяются по SHA1 (ассеты — по размеру и имени-хешу), загрузка в 16 потоков с ретраями.
- Лог игры — вкладка «Лог»; при краше показывается причина и кнопка «Открыть crash-report».

### Bedrock Edition
- Только Windows. Лаунчер проверяет пакет `Microsoft.MinecraftUWP` через PowerShell и запускает игру протоколом `minecraft:`. Если не установлена — открывает Microsoft Store.
- Bedrock использует аккаунт Microsoft/Xbox; Ely.by, моды Modrinth и смена версий Bedrock не поддерживаются (официального способа нет). Это написано прямо в интерфейсе.

### Modrinth
- `https://api.modrinth.com/v2`, `User-Agent: KonMin-Launcher/<версия>`, кеш ответов 5 минут, обработка 429 (`X-Ratelimit-Reset`).
- Установка мода: автоподбор версии под Minecraft и загрузчик сборки, обязательные зависимости ставятся рекурсивно.
- Модпаки: `.mrpack` → `modrinth.index.json` → файлы с проверкой SHA1 (только с доменов из спецификации mrpack) → `overrides/` и `client-overrides/` → новая сборка.
- Обновления модов — по SHA1 через `POST /version_files/update`.
- Датапаки кладутся в `minecraft/datapacks` — Minecraft подключает датапаки к конкретному миру, поэтому их нужно скопировать в `saves/<мир>/datapacks`.

---

## 3. Инструкция для новичка: получить setup.exe без программирования

Вам понадобится только аккаунт на GitHub (бесплатно). Сборка проходит на серверах GitHub.

### Шаг 1. Создать репозиторий
1. Зайдите на https://github.com и войдите (или зарегистрируйтесь).
2. Справа вверху нажмите **«+» → «New repository»**.
3. В поле **Repository name** напишите `konmin-launcher`.
4. Выберите **Public** (для Private бесплатных минут сборки меньше, но тоже работает).
5. Галочки «Add a README» **не ставьте**. Нажмите **«Create repository»**.

### Шаг 2. Загрузить файлы

**Вариант А — GitHub Desktop (проще всего, рекомендую):**
1. Скачайте и установите https://desktop.github.com, войдите своим аккаунтом.
2. **File → Clone repository** → выберите `konmin-launcher` → **Clone**. Запомните путь к папке.
3. Распакуйте архив проекта и скопируйте **содержимое** папки `konmin-launcher` (папки `src`, `src-tauri`, `.github` и файлы `package.json` и т.д.) в эту папку.
   ⚠ Папка `.github` скрытая: в Проводнике включите «Вид → Показать → Скрытые элементы» и убедитесь, что она скопировалась.
4. В GitHub Desktop слева появятся изменённые файлы. Внизу в поле **Summary** напишите `Первая версия` → **Commit to main** → вверху **Push origin**.

**Вариант Б — через браузер:**
1. На странице пустого репозитория нажмите ссылку **«uploading an existing file»**.
2. Перетащите в окно **все** папки и файлы проекта (браузер сохраняет структуру папок при перетаскивании папок).
3. Проверьте, что загрузилась папка `.github/workflows` с файлом `build.yml`. Если браузер её пропустил — нажмите **Add file → Create new file**, в имени напишите `.github/workflows/build.yml` и вставьте содержимое файла.
4. Нажмите **Commit changes**.

### Шаг 3. Запустить сборку
- Сборка запускается **сама** после каждого пуша в ветку `main`.
- Вручную: вкладка **Actions** → слева **Build KonMin Launcher** → справа **Run workflow** → **Run workflow**.
- Если на вкладке Actions просят подтверждение — нажмите **«I understand my workflows, go ahead and enable them»**.
- Первая сборка идёт ~15–25 минут (компилируется Rust), следующие — быстрее благодаря кешу.

### Шаг 4. Скачать setup.exe
**Из Actions (каждая сборка):**
1. Вкладка **Actions** → откройте последний запуск с зелёной галочкой ✅.
2. Внизу страницы, в разделе **Artifacts**, нажмите **KonMin-Launcher-Setup** — скачается zip.
3. Внутри — `KonMin Launcher_0.1.0_x64-setup.exe`.

**Из Releases (красивая ссылка для друзей):**
1. Откройте `src-tauri/tauri.conf.json` и при необходимости поменяйте `"version": "0.1.0"`.
2. Создайте тег той же версии: на GitHub **Releases → Draft a new release → Choose a tag** → введите `v0.1.0` → **Create new tag** → **Publish release**.
   (Или в GitHub Desktop: **Repository → Create tag**, затем Push.)
3. Сборка запустится автоматически и прикрепит `setup.exe` к релизу. Если релиз уже создан вручную, tauri-action добавит файл в него.

### Шаг 5. Установить
Запустите `KonMin Launcher_…_x64-setup.exe`, выберите язык (русский/английский), папку установки — готово. Будет ярлык на рабочем столе и в меню «Пуск». Удаление — через «Параметры → Приложения» («Установка и удаление программ»).

**Windows SmartScreen** пишет «Windows защитила ваш компьютер»? Это потому, что установщик не подписан платным сертификатом. Нажмите **«Подробнее» → «Выполнить в любом случае»**.

Если на компьютере нет WebView2 (чистая Windows 10), установщик скачает его сам — нужен интернет.

### Если сборка упала ❌
Откройте упавший запуск в Actions → шаг с красным крестиком → скопируйте последние 30 строк ошибки и пришлите их мне — подскажу исправление.

---

## 4. Локальная сборка на Windows

1. Установите:
   - **Node.js LTS** — https://nodejs.org
   - **Rust** — https://rustup.rs (при установке согласитесь поставить *Visual Studio C++ Build Tools* — «Desktop development with C++»).
   - WebView2 уже есть в Windows 10/11.
2. В папке проекта (PowerShell):
   ```powershell
   npm install
   npm run tauri dev      # запуск в режиме разработки
   npm run tauri build    # сборка установщика
   ```
3. Готовый файл: `src-tauri\target\release\bundle\nsis\KonMin Launcher_0.1.0_x64-setup.exe`.

Linux/macOS: те же команды (нужны системные зависимости Tauri — https://tauri.app/start/prerequisites/). В `tauri.conf.json` для этого замените `"targets": ["nsis"]` на `"all"` или `["deb", "appimage"]` / `["dmg"]`.

### Иконки
Готовые иконки уже лежат в `src-tauri/icons`. Чтобы заменить: положите свой PNG 1024×1024 как `src-tauri/icons/app-icon.png` и выполните
```powershell
npx tauri icon src-tauri/icons/app-icon.png
```

---

## 5. Опционально: подпись кода

Если у вас есть сертификат подписи кода (`.pfx`):
1. Закодируйте его в base64: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx")) | Set-Clipboard`
2. В репозитории: **Settings → Secrets and variables → Actions → New repository secret**:
   `WINDOWS_CERTIFICATE` (base64) и `WINDOWS_CERTIFICATE_PASSWORD`.
3. Шаг «Sign installer» в workflow начнёт подписывать setup.exe. Без секретов он просто пропускается.

## 6. Опционально: автообновление (Tauri updater)

Updater требует подписи обновлений своим ключом, поэтому включается отдельно:
1. `npm run tauri signer generate -- -w ~/.tauri/konmin.key` — получите приватный и публичный ключ.
2. Добавьте секреты `TAURI_SIGNING_PRIVATE_KEY` и `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` и пробросьте их в шаг tauri-action (`env:`).
3. `npm install @tauri-apps/plugin-updater @tauri-apps/plugin-process`, в `Cargo.toml`: `tauri-plugin-updater = "2"`, `tauri-plugin-process = "2"`, в `main.rs`: `.plugin(tauri_plugin_updater::Builder::new().build()).plugin(tauri_plugin_process::init())`, в capabilities: `"updater:default"`, `"process:allow-restart"`.
4. В `tauri.conf.json`:
   ```json
   "bundle": { "createUpdaterArtifacts": true, ... },
   "plugins": { "updater": {
     "pubkey": "<содержимое публичного ключа>",
     "endpoints": ["https://github.com/<вы>/konmin-launcher/releases/latest/download/latest.json"]
   } }
   ```
5. В tauri-action добавьте `includeUpdaterJson: true`. В UI вызовите `check()` из `@tauri-apps/plugin-updater` при старте, затем `downloadAndInstall()` и `relaunch()`.

---

Не связан с Mojang Studios, Microsoft, Ely.by или Modrinth. Minecraft — товарный знак Mojang Synergies AB.
