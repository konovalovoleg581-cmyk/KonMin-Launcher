<p align="center">
  <img src="branding/konmin-banner.webp" alt="KonMin Launcher — современный лаунчер Minecraft">
</p>

*Русский | English version: [README.md](README.md)*

**KonMin Launcher** — настольный лаунчер Minecraft для Windows, macOS и Linux с тёмным
современным интерфейсом. Ставит и запускает любую версию Minecraft, сам настраивает Fabric,
Quilt, Forge и NeoForge, скачивает нужную Java и устанавливает моды, сборки, ресурспаки и шейдеры
с Modrinth и CurseForge.

> KonMin Launcher — форк открытого [Millida Launcher](https://github.com/millida/launcher)
> (GPL-3.0-only). Он **не связан с Millida, не одобрен и не поддерживается Millida**. Онлайн-сервисы
> Millida, которыми код всё ещё пользуется, перечислены в [EXTERNAL-SERVICES.md](EXTERNAL-SERVICES.md).

<p align="center">
  <img src="screenshots/konmin-lobby.webp" alt="Лобби KonMin Launcher">
</p>

## Возможности

- **Любая версия Minecraft** из официального манифеста Mojang; каждый файл сверяется с отпечатками Mojang.
- **Загрузчики модов**: Fabric, Quilt, Forge и NeoForge ставятся автоматически.
- **Java сама**: под каждую версию скачивается и проверяется нужная сборка Eclipse Temurin.
- **Моды и сборки**: поиск и установка с Modrinth и CurseForge, `.mrpack` и архивы CurseForge,
  зависимости, обновления, сканер модов и карантин.
- **Аккаунты**: Microsoft (лицензия) через официальный вход по коду, офлайн-ник и, по желанию,
  аккаунт Millida для онлайн-функций Millida.
- **Сборки**: импорт из Prism, MultiMC, ATLauncher, GDLauncher, CurseForge, Modrinth App и
  `.minecraft`; миры, бэкапы, скриншоты, логи, разбор вылетов и исправления в один клик.
- **Внешний вид**: сине-фиолетовая тема KonMin, 20+ цветов акцента, обои, 21 язык интерфейса.

## КонМинли — логотип, значок и ИИ-помощник

<p align="center"><img src="branding/konminli/konminli-welcome.webp" width="640" alt="КонМинли — маскот и ИИ-помощник KonMin Launcher"></p>

**КонМинли (KonMinli)** — логотип KonMin, ставший персонажем: та же сине-фиолетовая плитка, пиксельная K
и голубая искра, а лицо — в пустых полях знака. Это и логотип лаунчера, и значок приложения (окно, панель
задач, установщик Windows), и встроенный ИИ-помощник. Возможности помощника те же, что у Milli в
оригинале: сборка модпаков, разбор вылетов, правка конфигов, история чатов. Он работает через ИИ-сервис
Millida, поэтому нужен вход в аккаунт Millida. Все файлы образа и как их пересобрать — в
[branding/README.md](branding/README.md).

## Чем отличается от Millida Launcher

| | Millida Launcher | KonMin Launcher |
| --- | --- | --- |
| Имя, значок, цвета, идентификатор | Millida, зелёный, `net.millida.launcher` | KonMin, сине-фиолетовый, `com.konmin.launcher` |
| Файл программы и установщик | `millida-launcher.exe`, `Millida Launcher_<v>_x64-setup.exe` | `konmin-launcher.exe`, `KonMin Launcher_<v>_x64-setup.exe` |
| Папка данных | `%APPDATA%\net.millida.launcher` | `%APPDATA%\com.konmin.launcher` (своя, ничего не общего) |
| Вход в программу | обязателен аккаунт Millida | **«Играть без аккаунта Millida»**: хватит лицензии Microsoft или офлайн-ника |
| Вход через Microsoft | приложение Azure от Millida | своё приложение Azure через `KONMIN_MS_CLIENT_ID` |
| Автообновление | сервер и ключ подписи Millida | выключено, пока вы не настроите свой канал |
| Статистика | включена по умолчанию, уходит в Millida | **выключена по умолчанию**, при включении уходит в API Millida |
| Discord Rich Presence | приложение Discord от Millida | выключено без `KONMIN_DISCORD_APP_ID` |
| Ссылки | `millida://` | `konmin://` |

## Сборка

Нужны [Bun](https://bun.sh), [Rust](https://rustup.rs) (stable) и
[зависимости Tauri 2](https://tauri.app/start/prerequisites/) для вашей системы. Подробно по
системам: [BUILDING.ru.md](BUILDING.ru.md).

```bash
bun install
bun run tauri dev          # запуск из исходников
bun run tauri build        # установщики в src-tauri/target/release/bundle/
```

На Windows получится `src-tauri\target\release\bundle\nsis\KonMin Launcher_<версия>_x64-setup.exe`.

Переменные сборки (`KONMIN_MS_CLIENT_ID`, `KONMIN_DISCORD_APP_ID`, `KONMIN_SITE_URL`,
`VITE_KONMIN_DOWNLOAD_PAGE`) и настройка автообновления описаны в [README.md](README.md#build-time-configuration).

## Ограничения

- Функции на API Millida (аккаунт Millida, друзья, чат, звонки, покупки в каталоге, скины и
  косметика Millida, облако, панель хостинга, **поиск** CurseForge) зависят от серверов Millida,
  которые могут в любой момент заблокировать неофициальные сборки.
- Сборки не подписаны сертификатом: Windows SmartScreen и macOS Gatekeeper предупредят.
- Обои, арт лобби и музыка в `public/` и `media/` — материалы оригинального проекта; перед
  публичным распространением их стоит заменить (см. [TRADEMARK.ru.md](TRADEMARK.ru.md)).

## Лицензия

GPL-3.0-only, см. [LICENSE](LICENSE) и [NOTICE](NOTICE). KonMin Launcher — изменённая версия
Millida Launcher © Millida (Роман Бабаскин); изменения © KonMin.

<sub>KonMin Launcher не связан с Mojang AB, Microsoft и Millida. Minecraft — товарный знак Mojang AB.</sub>
