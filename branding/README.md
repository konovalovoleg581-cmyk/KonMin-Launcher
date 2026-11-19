# KonMin Launcher brand: KonMinli

**КонМинли (KonMinli)** is the KonMin logo turned into a character. It is the launcher's logo, its app
icon and its AI assistant at the same time. There is one design, and every file below is a view of it.

The mark keeps the KonMin logo exactly: a 376-unit tile with corner radius 84 and a `#3D8BFF → #7B5CFF`
gradient, the white pixel **K** on a 7×7 grid of 30-unit cells (from 83 to 293) with a dark shadow
offset by (8, 10), and the cyan spark (`#5EF0FF`) in the K's top-right cell. KonMinli's face lives in
the mark's empty margins and never covers the K: two eyes with spark-cyan irises above it, a small
smile and blush below it. As a character, KonMinli also gets arms and legs in the tile colour.

## Files

| File | What it is | Used for |
| --- | --- | --- |
| `konminli/konminli-logo.svg` | the mark with KonMinli's face, transparent background | master logo; copied to `public/konmin-logo.svg` (title bar, loading screen, sign-in, welcome, settings) and `public/favicon.svg` |
| `konmin-icon-1024.png` | the same, 1024 px | source of every app icon (`src-tauri/icons/`: window, taskbar, Windows `.exe` and NSIS installer `icon.ico`, macOS `.icns`, Linux) |
| `konminli/konminli-avatar-{256,64,32}.png` | the same, small sizes | avatars, small icons |
| `konminli/konminli-mascot.png` | full character, waving, transparent | main mascot illustration |
| `konminli/konminli-{neutral,happy,thinking,surprised}.png` | expressions, transparent | stickers, docs, store pages |
| `konminli/konminli-welcome.webp` | assistant welcome illustration | docs, release pages |
| `konmin-banner.webp` | README banner | README |

Inside the app, KonMinli is not an image: it is drawn live by `src/components/milli/Milli.tsx` from the
geometry in `src/components/milli/milliMascot.ts` (with the colours in
`src/styles/pixel/milli-mascot.css`), with all 22 emotions, blinking, gaze, and reactions. The tests in
`milliMascot.test.ts` pin the mark: the K must sit exactly where it does in the logo, and no part of the
face may cover it or leave the tile.

## Regenerating

The PNG/SVG files above are exported from the live component, so they always match the app:

1. Start the web preview: `bun run dev`.
2. `node scripts/konminli-assets.cjs` (needs Playwright with Chromium). It renders `<Milli>` in each mode
   with reduced motion, screenshots the PNGs with a transparent background and writes the logo SVG with
   the computed colours inlined. The welcome illustration and the banner are HTML compositions of these.
3. Copy `konminli/konminli-logo.svg` to `public/konmin-logo.svg` and `public/favicon.svg`.
4. `python scripts/gen-app-icons.py` then `bunx tauri icon src-tauri/icons/icon-1024.png -o src-tauri/icons`.

The alternative app icons in Settings (`src-tauri/icons/alt/`) are the same KonMinli with a different
tile gradient.
