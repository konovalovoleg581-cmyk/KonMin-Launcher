# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Desktop Minecraft launcher: Tauri 2 (Rust core in `src-tauri/`) + React 19 / TypeScript webview (`src/`). Detailed design docs: `ARCHITECTURE.md`, `BUILDING.md`, `CONTRIBUTING.md` (each has a `.ru.md` twin — keep both in sync when editing docs).

## Commands

Bun is the only package manager / test runner (`bun.lock`; do not use npm/yarn/pnpm).

```bash
bun install
bun run tauri dev          # full app (core + webview)
bun run dev                # webview only at http://127.0.0.1:5173; core-dependent screens show placeholders
bun run typecheck          # tsc (strict, noUnusedLocals/Parameters, verbatimModuleSyntax); `lint` is the same
bun run test               # all frontend/script tests (scripts/test.mjs runs each file in its own `bun test`)
bun run test call/gate     # only test files whose path contains the substring
bun test src/state/msLogin.test.ts   # one file directly (bunfig preloads scripts/test-locale.ts)
bun run build:web          # tsc + vite build + frontend gate + startup budget check
bun run build:fast         # quick exe without installer (cargo profile "fast"); build:fast:bundle for an installer
bun run tauri build        # production bundles (NSIS on Windows, dmg, deb/rpm/AppImage)
```

Rust (run from `src-tauri/`; workspace = core + `voice` crate):

```bash
cargo clippy --all-targets -- -D warnings   # required; CI fails on any warning
cargo test
cargo test <name_substring>                 # single test
cargo test -- --ignored                     # network-dependent tests
```

No formatter is enforced (no Prettier, `cargo fmt` optional), but code should look rustfmt-formatted. TS style: 2-space indent, no semicolons, single quotes, `import type` for types. Code comments are written in English.

`installer/` is a separate Cargo project (`MillidaLauncherSetup`, a small Windows web-installer stub that downloads and minisign-verifies the release); it is not part of the `src-tauri` workspace.

## Architecture

Three layers with a hard security border:

```
src/**                     webview: display and input only
  ↓ invoke(cmd)  ↑ events
src-tauri/src/lib.rs       registers ~135 IPC commands in generate_handler!, plugins, tray, self-heal
src-tauri/src/commands/**  thin #[tauri::command] wrappers per area
src-tauri/src/engine/**    real logic: core, game, content, profiles, accounts, skins, media, cloud
src-tauri/src/secrets.rs   AES-256-GCM vault for tokens
```

Border rules (enforced by design and some tests):
- **Tokens never reach the webview.** Frontend passes `accountId`; the core pulls the token from the vault. Only presence flags are returned (`session_status`, `src/lib/secure.ts`).
- **The webview never touches paths or the filesystem.** It works with profile names, account IDs and job keys. Capabilities (`src-tauri/capabilities/default.json`) grant no fs/shell.
- **All untrusted paths** (mrpack, CurseForge manifests, IPC args) go through `safe_join` / `safe_child` / `safe_file_name` in `engine/core/safepath.rs`.
- **All downloads** go through the single `reqwest::Client` in `engine/core/http.rs` with hash/size verification (`download_checked`).
- `withGlobalTauri: false`: import Tauri APIs from packages. CSP `script-src 'self'` is pinned by a core test; a new external host must be added to both `csp` and `devCsp` in `tauri.conf.json`.
- Webview calls to the Millida backend go through the existing `millida_api` command (`engine/accounts/millida.rs`), not new proxies.

### Adding an IPC command
1. Logic in an `engine/**` module returning `Result<T, String>` (error text is user-facing, currently Russian); export from its `mod.rs`.
2. Wrapper in `commands/<area>.rs`; long work `async` + `spawn_blocking`, progress via `app.emit` and the job registry (`engine/core/jobs.rs`).
3. Register in `generate_handler!` in `lib.rs`.
4. Typed wrapper in `src/ipc/commands.ts` (camelCase args); events in `src/ipc/events.ts` (return `null` outside Tauri).

### Game launch pipeline
Entry: `install_and_launch_into` (`engine/game/launch.rs`) → `engine/game/pipeline/`: **Plan** (pure functions, `plan.rs`: merged version json, classpath, full Java command line) → **Prepare** (task graph, `graph.rs`: session, Java/Temurin, client, libraries, natives, assets, loader install for Fabric/Quilt/Forge/NeoForge) → **Start** → **Watch**. `warm.rs` pre-prepares from the lobby. Command lines of reference builds are snapshot-tested (`launch_snap.rs`, data in `src-tauri/tests/data/launch`) — update snapshots deliberately when changing args.

Per-instance settings live in `millida-settings.json` inside the instance folder; profiles in `profiles.json` under `data_dir()/net.millida.launcher`.

### Frontend
- No router: screens are `<section class="screen">` toggled by class `on`; active screen in `useUi().screen` (`src/state/ui.ts`); screens lazy-loaded via `src/screens/registry.ts`.
- One zustand store per area in `src/state/`.
- Plain CSS in `src/styles/`, imported in `src/main.tsx` in a fixed numeric order — the cascade depends on it; don't reorder.
- `localStorage` keys use the `m-` prefix and must stay backward compatible (migration required to rename).
- **i18n:** the Russian source string *is* the key: `t('Русский текст')`. Other locales are `src/i18n/locales/*.json` mapping Russian → translation (fallback: locale → English → Russian key). `scripts/i18n-extract.mjs` collects `t(...)` calls; `src/i18n/coverage.test.ts` checks tables. Changing a Russian UI string changes its key in every locale file.
- **Build gate:** the bundle must still call `frontend_ready` (`scripts/check-frontend-gate.mjs`); otherwise `engine/core/selfheal.rs` treats the install as broken and reinstalls on every start.
- Calls/voice are peer-to-peer WebRTC mesh (`src/state/call.ts`, `src/lib/call/`); the mic worklet is loaded via `blob:` to avoid widening CSP.

## Build-time configuration
- `MILLIDA_MS_CLIENT_ID` (compile-time `option_env!`) — Azure app for Microsoft sign-in; without it the app builds and sign-in reports it is not configured.
- `tauri.conf.json` `version` is `2.0.0` in source; the updater (`plugins.updater.pubkey`, minisign) will self-update local builds to the official release unless the version is raised. `tauri.release.conf.json` is used by `build:release`.
