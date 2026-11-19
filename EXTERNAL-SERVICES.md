# External services used by KonMin Launcher

KonMin Launcher is a fork of [Millida Launcher](https://github.com/millida/launcher) (GPL-3.0-only).
The rebrand changed the application's name, icons, identifiers and colours. It did **not**
create any KonMin servers. Every online feature still talks to the same services as upstream,
and most of them belong to **Millida**, a third party that has no relationship with KonMin.

This file lists those dependencies so that nobody mistakes a Millida service for a KonMin one.
It was compiled from the host names in `src/` and `src-tauri/src/` at the time of the rebrand.

## 1. Services that work independently of Millida

These are the official services of Mojang/Microsoft and of the mod ecosystem. The core features
of the launcher (installing and starting Minecraft, Java, mod loaders, Modrinth content) only need
these.

| Service | Hosts | Used for |
| --- | --- | --- |
| Mojang / Minecraft | `piston-meta.mojang.com`, `piston-data.mojang.com`, `launchermeta.mojang.com`, `libraries.minecraft.net`, `resources.download.minecraft.net`, `launchercontent.mojang.com`, `textures.minecraft.net`, `sessionserver.mojang.com` | version manifest, client, libraries, assets, news, skins |
| Microsoft / Xbox | `login.microsoftonline.com`, `user.auth.xboxlive.com`, `xsts.auth.xboxlive.com`, `api.minecraftservices.com` | licensed-account sign-in (device code flow), profile, skin and cape upload |
| Fabric / Quilt / Forge / NeoForge | `meta.fabricmc.net`, `meta.quiltmc.org`, `maven.minecraftforge.net`, `files.minecraftforge.net`, `maven.neoforged.net` | mod loader metadata and installers |
| Java runtimes | `api.adoptium.net` (Eclipse Temurin, files on `github.com`), `api.azul.com` / `cdn.azul.com` | downloading the right Java |
| Modrinth | `api.modrinth.com`, `cdn.modrinth.com` | mod / modpack / resource pack search and download |
| CurseForge files | `edge.forgecdn.net`, `mediafilez.forgecdn.net` | downloading CurseForge files (the *search API* goes through Millida, see below) |
| Discord (local IPC only) | none | Rich Presence; **off** unless `KONMIN_DISCORD_APP_ID` is set |
| YouTube / SoundCloud embeds | `www.youtube-nocookie.com`, `w.soundcloud.com` | music-by-link and trailers (CSP `frame-src`) |

## 2. Millida services (third party)

Everything below is operated by Millida. A KonMin build sends requests there exactly as upstream
does. Millida's [TRADEMARK.md](TRADEMARK.md) says requests from unofficial builds **may be blocked
without notice**, so any of these features can stop working for KonMin users at any time.
Requests identify themselves honestly with the User-Agent `KonMinLauncher/<version> (fork of Millida Launcher)`.

| Host | What depends on it |
| --- | --- |
| `api.millida.net` (`/v2`) | Millida account sign-in and session refresh, friends, chat, calls signalling, parties, cloud profile sync, Millida catalog and paid packs, wallet and purchases, Millida skins/capes/cosmetics, hosting panel, feedback, share codes, CurseForge **search proxy**, remote translations and remote UI screens (signed), usage statistics (opt-in in KonMin), error reports |
| `wss://api.millida.net` | realtime events (friends, calls, rooms) |
| `millida.net` | account pages (`/auth/launcher`, profiles `/u/<nick>`), site catalog pages, public share pages |
| `cdn.millida.net`, `cdn.millida.trade`, `millida.trade` | catalog art, cosmetics and store images |
| `garage.millida.net` | Millida catalog pack and mod files |
| `api.millida.net/v2/yggdrasil` | the Yggdrasil-compatible login/skin server that authlib-injector and CustomSkinLoader point the game at for Millida accounts |
| `logs.millida.net` | "share log" uploads |
| `launcher-storage.millida.net` | upstream update manifests and media mirror. **KonMin does not use it for updates** (see below); `scripts/media.mjs` can still fetch build media from it when `MEDIA_REMOTE=1` |
| Millida mod (`net.millida.mod`) | in-game Millida cosmetics/skins mod installed into instances when a Millida account is used |

Features that are entirely local or use only section 1 keep working without Millida: offline
(nickname) play, Microsoft accounts, installing and launching any vanilla/Fabric/Quilt/Forge/NeoForge
version, Modrinth content, importing instances from other launchers, worlds, screenshots,
backups, clips, settings, themes.

## 3. What was deliberately switched off or made configurable

| Upstream behaviour | KonMin Launcher | How to turn it on for your own release |
| --- | --- | --- |
| Microsoft sign-in used Millida's built-in Azure `client_id` | No built-in id: sign-in reports that it is not configured | Register an Azure app (personal Microsoft accounts, device code flow, `XboxLive.signin offline_access`) and build with `KONMIN_MS_CLIENT_ID=<id>` |
| Auto-update from `launcher-storage.millida.net`, verified with Millida's minisign key | No endpoints, no key: the launcher never checks for updates | Generate your own key (`bunx tauri signer generate`), publish `latest.json` manifests, then fill `plugins.updater.endpoints` and `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`; optionally set `VITE_KONMIN_DOWNLOAD_PAGE` |
| Discord Rich Presence with Millida's Discord app | Off | Set `KONMIN_DISCORD_APP_ID` (build or run time); `KONMIN_SITE_URL` adds a "Download launcher" button |
| Usage statistics on by default (sent to `api.millida.net`) | Off by default (opt-in in Settings → Account) | — |
| `millida://` deep links | KonMin registers `konmin://`; `millida://` links are still understood if the OS hands one over | — |
| Signed Windows installer (Certum), VirusTotal claims in the security page | Removed from the UI: KonMin builds are unsigned | Sign your own builds (see [CODE_SIGNING.md](CODE_SIGNING.md) for how upstream does it) |

## 4. Not part of the KonMin build

- `installer/`: upstream's tiny Windows web installer. It downloads **Millida Launcher** releases from
  Millida's CDN, so it is not rebranded or used for KonMin. The KonMin Windows installer is the Tauri
  NSIS bundle (`KonMin Launcher_<version>_x64-setup.exe`).
- `.github/workflows/release.yml`, `setup.yml`, `manifest.yml`, `verify.yml`, `warm.yml`: Millida's
  release pipeline (Millida storage, Millida signing secrets). Most jobs are guarded by
  `github.repository == 'millida/launcher'`; review them before enabling Actions in a KonMin repository.
- Wallpapers and music in `public/bg`, `public/lobby`, `media/`: upstream artwork. Millida's TRADEMARK.md
  lists `public/bg/` and similar design images as Millida brand material; replace them before
  distributing KonMin builds publicly.
