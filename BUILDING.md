# How to build KonMin Launcher yourself

Russian version: [BUILDING.ru.md](BUILDING.ru.md)

Three commands. The first build takes 10–20 minutes, depending on your computer. Later builds are faster: Rust rebuilds only what changed.

## 1. Install the tools

<details open>
<summary><b>Windows 10/11</b></summary>

In PowerShell:

```powershell
winget install --id Git.Git -e
winget install --id Oven-sh.Bun -e
winget install --id Rustlang.Rustup -e
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

After the install, close PowerShell and open it again. Otherwise it will not see `bun` and `cargo`.

Windows 11 and most supported Windows 10 versions include WebView2. For a
development machine without it, [install the Runtime from Microsoft](https://developer.microsoft.com/microsoft-edge/webview2/).
When the Runtime is missing, the Windows installer built from this source downloads
Microsoft's bootstrapper and installs it (`src-tauri/installer-hooks.nsh`). A failure there
does not stop the launcher install.
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

For other distributions, see the package names in the [Tauri docs](https://tauri.app/start/prerequisites/#linux).
</details>

## 2. Build

```bash
cd <the KonMin Launcher source folder>
bun install
bun run tauri build
```

Optional build-time settings (Microsoft sign-in, Discord, updates) are described in
[README.md](README.md#build-time-configuration). For example, in PowerShell:

```powershell
$env:KONMIN_MS_CLIENT_ID = "<your Azure application (client) id>"
bun run tauri build
```

## 3. Get the result

| System | Where it is |
| --- | --- |
| Windows | `src-tauri\target\release\bundle\nsis\KonMin Launcher_<version>_x64-setup.exe` |
| macOS | `src-tauri/target/release/bundle/dmg/` and `bundle/macos/KonMin Launcher.app` |
| Linux | `src-tauri/target/release/bundle/`: `deb/`, `rpm/`, `appimage/` |

To run it straight from the source without installing: `bun run tauri dev`.

The NSIS installer installs for the current user (no administrator rights), adds "KonMin Launcher"
shortcuts, registers the `konmin://` link scheme and an uninstaller.
If the WebView2 Runtime is missing, the installer downloads Microsoft's bootstrapper
(`src-tauri/installer-hooks.nsh`).

## Updates and signing

KonMin Launcher ships **without** an update channel and **without** a code-signing certificate:

- `plugins.updater.endpoints` and `plugins.updater.pubkey` in
  [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) are empty, so the launcher never checks
  for updates (neither the window nor the core). To publish updates, generate a key pair with
  `bunx tauri signer generate`, put the **public** key into `pubkey`, your `latest.json` URLs into
  `endpoints`, keep the private key in CI secrets (`TAURI_SIGNING_PRIVATE_KEY`) and build with
  `bun run build:release` (it also writes the `.sig` update artifacts).
- Unsigned installers make Windows show "Unknown publisher" / SmartScreen. Signing needs your own
  certificate; [CODE_SIGNING.md](CODE_SIGNING.md) describes how upstream signs its builds.

## If the build fails

| Error | What to do |
| --- | --- |
| `linker 'link.exe' not found` | The C++ Build Tools are missing. Use the Windows command from step 1 |
| `bun` or `cargo` "is not recognized as a command" | Restart the terminal after the install |
| `webkit2gtk-4.1 not found` | The Linux packages from step 1 are not installed |
| `alsa-sys` build script fails | Install `libasound2-dev` (Linux) |
| AppImage fails on `linuxdeploy` | Build without it: `bun run tauri build --bundles deb` |

Want to send a fix? See [CONTRIBUTING.md](CONTRIBUTING.md). The name and logo rules of the upstream
project: [TRADEMARK.md](TRADEMARK.md).
