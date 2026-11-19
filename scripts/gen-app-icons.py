#!/usr/bin/env python3
"""KonMin Launcher app icons: the bundle icon and its alternative colourways.

The mark is a pixel "K" (7x7 grid) on a rounded tile, the same geometry as
public/konmin-logo.svg. The default icon has the blue-violet gradient, a soft glare,
a drop shadow under the glyph and the cyan "spark" block; the alternatives are flat
(tile colour + glyph colour), so the picker in Settings shows exactly what the core
puts on the window, the taskbar, the Dock and the shortcuts.

Run from the repository root:

    python scripts/gen-app-icons.py            # writes everything below
    bunx tauri icon src-tauri/icons/icon-1024.png   # (re)derives the bundle sizes, .ico, .icns

Writes src-tauri/icons/icon-1024.png (source for `tauri icon`),
src-tauri/icons/alt/<id>/{32x32,128x128,256x256,512x512,runtime-256}.png, icon.ico,
icon.icns and public/app-icons/<id>.png (default.png is the bundle icon itself).
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter, IcnsImagePlugin  # noqa: F401  (registers the ICNS writer)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Geometry on a 376-unit tile, kept in sync with public/konmin-logo.svg.
TILE = 376
RADIUS = 84
CELL = 30
OFFSET = 83
GLYPH = ["XX...XX", "XX..XX.", "XX.XX..", "XXXX...", "XX.XX..", "XX..XX.", "XX...XX"]
SPARK = (6, 0)  # column, row of the accent block

GRAD_FROM = (0x3D, 0x8B, 0xFF)
GRAD_TO = (0x7B, 0x5C, 0xFF)
SPARK_COLOUR = (0x5E, 0xF0, 0xFF)

PALETTE = {
    "spark": ("#0b2a4a", "#5ef0ff"),
    "flame": ("#d8321a", "#ffd84a"),
    "amethyst": ("#7d3ff0", "#ffffff"),
    "legend": ("#13227a", "#ffc547"),
    "gold": ("#f0a828", "#ffffff"),
    "diamond": ("#38c4f5", "#ffffff"),
    "emerald": ("#14b06e", "#ffffff"),
    "quartz": ("#ec6aa2", "#ffffff"),
    "obsidian": ("#1d1230", "#b98cff"),
}


def rgb(hex_colour):
    h = hex_colour.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def tile_mask(size):
    k = size / TILE
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size - 1, size - 1), radius=round(RADIUS * k), fill=255)
    return m


def glyph_mask(size, dx=0.0, dy=0.0, only=None):
    k = size / TILE
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    for r, row in enumerate(GLYPH):
        for c, ch in enumerate(row):
            if ch != "X" or (only is not None and (c, r) != only):
                continue
            x0 = (OFFSET + c * CELL + dx) * k
            y0 = (OFFSET + r * CELL + dy) * k
            d.rectangle((round(x0), round(y0), round(x0 + CELL * k) - 1, round(y0 + CELL * k) - 1), fill=255)
    return m


def gradient(size):
    im = Image.new("RGB", (size, size))
    px = im.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = tuple(round(GRAD_FROM[i] + (GRAD_TO[i] - GRAD_FROM[i]) * t) for i in range(3))
    return im


def default_icon(size=1024):
    """Drawn at 4x and scaled down, so the rounded corners are antialiased."""
    big = size * 4
    out = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    body = gradient(big // 4).resize((big, big), Image.BICUBIC).convert("RGBA")
    glare = Image.new("RGBA", (big, big), (255, 255, 255, 0))
    gp = ImageDraw.Draw(glare)
    for y in range(big // 2):
        gp.line((0, y, big, y), fill=(255, 255, 255, round(56 * (1 - y / (big / 2)))))
    body = Image.alpha_composite(body, glare)
    out.paste(body, (0, 0), tile_mask(big))
    shadow = glyph_mask(big, 8, 10).filter(ImageFilter.GaussianBlur(big / 400))
    out.paste((11, 13, 42, 255), (0, 0), shadow.point(lambda v: v * 30 // 100))
    out.paste((255, 255, 255, 255), (0, 0), glyph_mask(big))
    out.paste(SPARK_COLOUR + (255,), (0, 0), glyph_mask(big, only=SPARK))
    return out.resize((size, size), Image.LANCZOS)


def flat_icon(tile, glyph, size=1024):
    big = size * 4
    out = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    out.paste(tile + (255,), (0, 0), tile_mask(big))
    out.paste(glyph + (255,), (0, 0), glyph_mask(big))
    return out.resize((size, size), Image.LANCZOS)


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
    os.makedirs(os.path.join(ROOT, "public", "app-icons"), exist_ok=True)
    icon = default_icon()
    icon.save(os.path.join(ROOT, "src-tauri", "icons", "icon-1024.png"), optimize=True)
    sized(icon, 256).save(os.path.join(ROOT, "public", "app-icons", "default.png"), optimize=True)
    print("ok default")
    for name, (tile, glyph) in PALETTE.items():
        export(name, flat_icon(rgb(tile), rgb(glyph)))
        print("ok", name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
