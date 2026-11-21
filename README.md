<p align="center">
  <img src="branding/konmin-mobile-banner.png" alt="KonMin Launcher Mobile: Minecraft Java Edition on Android">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Android-8%2B%2C%20arm64-5B7CFF" alt="Android 8 or newer, arm64">
  <img src="https://img.shields.io/badge/Kotlin-Jetpack%20Compose-5B7CFF" alt="Kotlin and Jetpack Compose">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0--only-555" alt="License GPL-3.0-only"></a>
</p>

*English | Русская версия: [README.ru.md](README.ru.md)*

**KonMin Launcher Mobile** is an Android launcher for **Minecraft Java Edition**: the same versions
as on a computer, with Fabric, Quilt, Forge and NeoForge, mods and modpacks from Modrinth and
CurseForge, resource packs, shaders, worlds, touch controls, keyboard, mouse and gamepad.

> KonMin Launcher Mobile is a fork of the open-source
> [Millida Launcher Mobile](https://github.com/millida/launcher-mobile) (GPL-3.0-only). It is **not
> affiliated with, endorsed by or supported by Millida**. What was changed is listed in
> [MODIFICATIONS.md](MODIFICATIONS.md); the outside services the app can talk to are listed below.

## Install on your phone

1. Download the APK:
   - from this repository's **Releases** page, or
   - from the **Actions** tab → the latest successful *Android APK* run → **Artifacts** →
     `KonMin-Launcher-Mobile` (you need to be signed in to GitHub; the artifact is a zip with the APK inside).
2. Open the downloaded `KonMin-Launcher-Mobile-debug.apk`. Android asks whether the browser or file
   manager may install apps: allow it ("Install unknown apps").
3. Open **KonMin**, choose how you play (Microsoft licence or an offline nickname), create a modpack in
   **Versions** and tap **Play**. The first start of a version downloads the game files from Mojang once.

**Phone requirements:** Android 8.0 or newer, a 64-bit processor (arm64), 4 GB of RAM or more,
OpenGL ES 3.0 (ES 3.2 for shaders). Not every Minecraft version or mod runs well on every phone: start
with vanilla or Fabric and a render distance of 6 on weaker devices.

## What is inside

- **Six sections**: Home (play the selected modpack, account, progress), Versions (your modpacks with
  their Minecraft version and loader), Mods (Modrinth and CurseForge catalog), Servers (join by address),
  Skins, Settings.
- **The real game engine of the original project**: Mojang version manifest and hash-checked downloads,
  Fabric / Quilt / Forge / NeoForge installers, OpenJDK 8 / 21 / 25 for Android, the Krypton, GL4ES,
  ANGLE and MobileGlues renderers, SDL3, touch / keyboard / mouse / gamepad input, worlds, backups,
  screenshots, crash analysis.
- **The Java + graphics runtime pack is inside the APK** (built from public sources, see below), so the
  game starts without any launcher server.
- **Accounts**: Microsoft through the official device-code page (the app never sees your password;
  tokens are stored encrypted with Android Keystore), offline nicknames, account switching.

## Configuration of online services

A KonMin build talks only to Mojang/Microsoft, Modrinth, CurseForge's file CDN, the loader sites and the
Java/runtime sources. Everything that would need a KonMin server is off until it is configured:

| Setting (`gradle.properties`, `-P…` or environment) | Enables | Default |
| --- | --- | --- |
| `konmin.msClientId` / `KONMIN_MS_CLIENT_ID` | Microsoft (licensed) sign-in. Register your own app in Microsoft Entra ID for **personal Microsoft accounts**, allow public client flows, and request Minecraft API access for it. | empty: Microsoft sign-in says it is not set up; offline nicknames work |
| `konmin.runtimeManifestUrl` / `KONMIN_RUNTIME_MANIFEST_URL` | downloading runtime updates from a KonMin server | empty: the bundled pack is used |
| `konmin.millidaServices` / `KONMIN_MILLIDA_SERVICES` | Millida's account, friends, chat, shop, hosting, cloud sync, server rating and statistics (third-party servers) | `false`: no request ever goes to a Millida host |

With Millida services off, the screens that depend on them say so instead of failing, and the HTTP
client refuses every `*.millida.net` / `*.millida.trade` request (`KonMinConfig`).

## Build in the cloud (from a phone)

Push to the `konmin-mobile` branch, or open **Actions → Android APK → Run workflow**. The workflow
([`.github/workflows/android.yml`](.github/workflows/android.yml)) installs the Android SDK, builds the
runtime pack and the APK, and uploads it as an artifact. Pushing a tag such as `v1.0.0` also publishes a
GitHub Release. Details, local builds and signing: [BUILDING.md](BUILDING.md).

## Runtime pack sources

`scripts/make_konmin_runtime.py` assembles `dist/konmin-runtime-arm64.zip` from:

- ZalithLauncher2 2.4.11 for arm64 (GPL-3.0): Java 21 and 25, renderers, LWJGL/GLFW layer
  (sha256 `b19adc0a…6ff8b84`);
- OpenJDK 8 for Android arm64, AngelAuraMC build (GPL-2.0 with the Classpath Exception)
  (sha256 `9a59124d…f0e06d`);
- `bridge/` of this repository (GPL-3.0-only).

Every file is checked against its SHA-256; the pack carries a `NOTICE-KONMIN.txt` with the sources.

## Branding

`branding/` holds the KonMin mark (the KonMinli logo shared with the KonMin desktop launcher), the
Android icon sources and the README banner; `scripts/gen_konmin_icons.py` regenerates the launcher
icons (adaptive, monochrome and the in-app icon choices). Colours: background `#0F172A`, secondary
background `#172033`, primary `#5B7CFF`, accent `#FFB703`, text `#FFFFFF` / `#AAB4C8`.

## License

GPL-3.0-only ([LICENSE](LICENSE)). KonMin Launcher Mobile is a modified version of Millida Launcher
Mobile; the original copyright notices are kept, and the modifications are listed in
[MODIFICATIONS.md](MODIFICATIONS.md). Third-party components: [THIRD-PARTY.md](THIRD-PARTY.md).
If you distribute an APK, you must also offer its corresponding source code (this repository at the
commit the APK was built from).

<sub>KonMin Launcher Mobile is not affiliated with Mojang AB, Microsoft or Millida. Minecraft is a trademark of Mojang AB.</sub>
