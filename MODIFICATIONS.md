# Modifications in KonMin Launcher Mobile

KonMin Launcher Mobile is a modified version of **Millida Launcher Mobile**
(https://github.com/millida/launcher-mobile, commit `c5a8bb0`, "Millida Mobile 1.10.11"),
© Millida, licensed GPL-3.0-only. As section 5 of the GPL asks, this file states what was changed
and when. All changes were made in November 2026 by the KonMin Team and are licensed GPL-3.0-only.

## Identity and branding

- Application id `net.konmin.launcher.mobile` (was `net.millida.launcher`; the debug suffix is removed
  because the debug APK is the one distributed until a KonMin release key exists). Name "KonMin
  Launcher Mobile", home-screen label "KonMin", version 1.0.0-konmin.
- New launcher icon (adaptive, monochrome and the six in-app icon choices) and in-app logo: the KonMin
  mark / KonMinli, shared with the KonMin desktop launcher. Millida's sign and wordmark are removed.
- New dark palette (background `#0F172A`, surface `#172033`, primary `#5B7CFF`, accent `#FFB703`,
  text `#FFFFFF` / `#AAB4C8`) and a default "KonMin" accent.
- `konmin://` deep links instead of `millida://`; the verified `millida.net` app links are removed.
- Interface texts that named the app itself (screenshots folder, Files root, welcome, update and share
  titles, "KonMin Launcher on a computer") renamed in all 21 languages; texts about Millida's own
  services keep the Millida name.
- User-Agent `KonMinLauncher/android-…`; Modrinth User-Agent with the KonMin project address.

## Services and credentials

- `KonMinConfig` (core): Millida's online services are off unless `konmin.millidaServices=true`. The
  shared HTTP client refuses every `*.millida.net` / `*.millida.trade` request while they are off.
- Sections that only exist as Millida services (shop, friends, chat, hosting, cabinet, premium, Bedrock
  through Millida) show a notice instead of opening; the Millida sign-in screen is replaced by the
  Microsoft / offline account step; usage statistics are never recorded.
- Microsoft sign-in: the built-in Millida Azure client id is removed; the id comes from
  `konmin.msClientId` / `KONMIN_MS_CLIENT_ID`.
- Self-update is off (`SELF_UPDATE=false`): there is no KonMin update server yet.
- Runtime manifest URL comes from `konmin.runtimeManifestUrl`; the Millida storage address is removed.
- Signing config renamed to `konmin` with `KONMIN_KEYSTORE_*` settings; a release builds unsigned
  instead of failing when no key is configured. No Millida key, credential or secret is used.

## Runtime pack

- `scripts/make_konmin_runtime.py`: builds the Java + graphics pack from public, hash-pinned sources
  (ZalithLauncher2 2.4.11, AngelAuraMC OpenJDK 8, this repository's `bridge/`), adds Java 8 and a
  `NOTICE-KONMIN.txt`. The CI build puts it inside the APK.

## Interface

- Six-section navigation: Home, Versions, Mods, Servers, Skins, Settings — a rail on the left in
  landscape (upstream had no section bar there) and the bottom bar in portrait.
- New **Versions** screen (`ui/VersionsScreen.kt`): the modpacks on the phone with version and loader,
  create / open / play / delete through the existing view-model functions.
- **Servers** without Millida services (`ui/ServersOffline.kt`): join by address and the per-modpack
  server lists instead of Millida's rating.
- Settings shows the former "More" entries (account, screenshots, pack codes) in portrait too.

## Build, tests and docs

- `.github/workflows/android.yml`: cloud build of the APK (artifact; Release on `v*` tags).
- `KonMinShotsTest` (screenshots of the real app), `KonMinConfigTest` (Millida hosts blocked, statistics
  off), Microsoft client-id tests.
- Upstream tests that pinned Millida behaviour now pin the KonMin behaviour: the User-Agent test, the
  section test (six sections instead of five), the Microsoft tests (a test client id); the telemetry tests
  switch Millida services on for themselves, since they test the mechanism; the "dead DNS" Microsoft test
  disables the system proxy so it stays hermetic behind an HTTP proxy.
- README, BUILDING, MODIFICATIONS, a KonMin section in THIRD-PARTY and TRADEMARK, notes on inherited
  upstream policy documents. The upstream LICENSE and copyright notices are kept unchanged.
