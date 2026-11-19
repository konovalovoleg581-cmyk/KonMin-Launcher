#!/usr/bin/env python3
"""KonMin Launcher app icons: KonMinli, the launcher's mascot, is the icon.

The source is public/konmin-logo.svg: the KonMin mark (blue-violet tile, white pixel "K", cyan
spark) with KonMinli's face, exported from the mascot component in src/components/milli
(Milli.tsx + milliMascot.ts). The default icon is that file as is; the alternative icons in
Settings swap only the tile gradient, so every choice is still the same KonMinli.

Run from the repository root (needs `rsvg-convert` from librsvg and Pillow):

    python scripts/gen-app-icons.py
    bunx tauri icon src-tauri/icons/icon-1024.png -o src-tauri/icons

Writes src-tauri/icons/icon-1024.png (source for `tauri icon`, which derives the bundle sizes,
icon.ico for the Windows exe and installer, icon.icns), src-tauri/icons/alt/<id>/{32x32,128x128,
256x256,512x512,runtime-256}.png, icon.ico, icon.icns and public/app-icons/<id>.png
(default.png is the bundle icon itself).
"""
import io
import os
import subprocess
import sys
from PIL import Image, IcnsImagePlugin  # noqa: F401  (registers the ICNS writer)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, "public", "konmin-logo.svg")
# The tile gradient stops of the KonMin mark, as the exported SVG spells them.
STOPS = ("#3D8BFF", "#7B5CFF")

# id -> (from, to) gradient. Ids are the ones the settings picker and src-tauri/src/app_icon.rs know.
PALETTE = {
    "spark": ("#0e7490", "#22d3ee"),
    "flame": ("#e2531f", "#f59e0b"),
    "amethyst": ("#6d28d9", "#a855f7"),
    "legend": ("#1e3a8a", "#4338ca"),
    "gold": ("#d97706", "#facc15"),
    "diamond": ("#0ea5e9", "#67e8f9"),
    "emerald": ("#047857", "#22c55e"),
    "quartz": ("#db2777", "#f472b6"),
    "obsidian": ("#1e1b2e", "#3b2a5a"),
}


def render(svg_text, size):
    png = subprocess.run(
        ["rsvg-convert", "-w", str(size), "-h", str(size), "-f", "png"],
        input=svg_text.encode("utf-8"),
        stdout=subprocess.PIPE,
        check=True,
    ).stdout
    return Image.open(io.BytesIO(png)).convert("RGBA")


def sized(im, s):
    return im.resize((s, s), Image.LANCZOS)


def export(name, icon):
    out = os.path.join(ROOT, "src-tauri", "icons", "alt", name)
    os.makedirs(out, exist_ok=True)
    for s in (32, 128, 256, 512):
        sized(icon, s).save(os.path.join(out, f"{s}x{s}.png"), optimize=True)
    sized(icon, 256).save(os.path.join(out, "runtime-256.png"), optimize=True)
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    sized(icon, 256).save(os.path.join(out, "icon.ico"), sizes=[(s, s) for s in ico_sizes])
    sized(icon, 1024).save(os.path.join(out, "icon.icns"))
    sized(icon, 256).save(os.path.join(ROOT, "public", "app-icons", f"{name}.png"), optimize=True)


def main():
    svg = open(LOGO, encoding="utf-8").read()
    if not all(stop in svg for stop in STOPS):
        sys.exit(f"{LOGO} lacks the tile gradient {STOPS}: regenerate the logo from the mascot first")
    os.makedirs(os.path.join(ROOT, "public", "app-icons"), exist_ok=True)
    icon = render(svg, 1024)
    icon.save(os.path.join(ROOT, "src-tauri", "icons", "icon-1024.png"), optimize=True)
    sized(icon, 256).save(os.path.join(ROOT, "public", "app-icons", "default.png"), optimize=True)
    print("ok default")
    for name, (a, b) in PALETTE.items():
        export(name, render(svg.replace(STOPS[0], a).replace(STOPS[1], b), 1024))
        print("ok", name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
