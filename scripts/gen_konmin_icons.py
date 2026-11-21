#!/usr/bin/env python3
"""Regenerates KonMin Launcher Mobile's launcher icons and in-app logo from branding/konmin-logo.svg.

Writes app/src/main/res/drawable/{ic_brand_logo,ic_launcher_glyph,ic_launcher_mono}.xml (vector drawables)
and the mipmap PNG / WebP layers (legacy icons, adaptive foreground, the in-app icon choices).
Needs Python 3 and `rsvg-convert` (librsvg) plus ImageMagick `convert` for WebP.

    python3 scripts/gen_konmin_icons.py
"""
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = os.path.join(ROOT, 'branding', 'konmin-logo.svg')
RES = os.path.join(ROOT, 'app', 'src', 'main', 'res')
"""Converts the KonMin logo SVG (rects, paths, translate/scale groups, one linear gradient) to an Android VectorDrawable."""
import xml.etree.ElementTree as ET
SVG = '{http://www.w3.org/2000/svg}'

def color(fill, opacity):
    m = re.match(r'rgb\((\d+),\s*(\d+),\s*(\d+)\)', fill or '')
    if m:
        r, g, b = map(int, m.groups())
        return '#%02X%02X%02X' % (r, g, b), opacity
    return fill, opacity

def convert(src, out, view, size_dp, drop_tile=False, mono=None, only_glyph=False):
    root = ET.parse(src).getroot()
    grad = root.find('.//' + SVG + 'linearGradient')
    lines = []
    def walk(el, depth, in_glyph):
        tag = el.tag.replace(SVG, '')
        ind = '    ' * depth
        if tag in ('defs', 'linearGradient', 'stop'):
            return
        if tag == 'g':
            t = el.get('transform', '')
            attrs = []
            for kind, args in re.findall(r'(translate|scale)\(([^)]*)\)', t):
                nums = [float(x) for x in re.split(r'[ ,]+', args.strip()) if x]
                if kind == 'translate':
                    attrs += ['android:translateX="%g"' % nums[0], 'android:translateY="%g"' % (nums[1] if len(nums) > 1 else 0)]
                else:
                    attrs += ['android:scaleX="%g"' % nums[0], 'android:scaleY="%g"' % (nums[1] if len(nums) > 1 else nums[0])]
            op = el.get('opacity')
            kids = list(el)
            if not kids:
                return
            lines.append(ind + '<group %s>' % ' '.join(attrs))
            for k in kids:
                walk(k, depth + 1, in_glyph)
            lines.append(ind + '</group>')
            return
        if tag == 'rect':
            x, y, w, h = (float(el.get(a)) for a in ('x', 'y', 'width', 'height'))
            d = 'M%g,%gh%gv%gh%gz' % (x, y, w, h, -w)
        elif tag == 'path':
            d = el.get('d')
        else:
            return
        fill = el.get('fill')
        op = float(el.get('fill-opacity', '1'))
        is_tile = fill and fill.startswith('url(')
        if drop_tile and (is_tile or d.startswith('M84 0H292') or d.startswith('M32.04') or d.startswith('M18 32') or d.startswith('M358 32') or d.startswith('M19.66')):
            return
        if mono:
            col = mono
        elif is_tile:
            stops = grad.findall(SVG + 'stop')
            a, b = stops[0].get('stop-color'), stops[-1].get('stop-color')
            lines.append(ind + '<path android:pathData="%s">' % d)
            lines.append(ind + '    <aapt:attr name="android:fillColor">')
            lines.append(ind + '        <gradient android:type="linear" android:startX="0" android:startY="0" android:endX="376" android:endY="376" android:startColor="%s" android:endColor="%s" />' % (a, b))
            lines.append(ind + '    </aapt:attr>')
            lines.append(ind + '</path>')
            return
        else:
            col, op = color(fill, op)
        alpha = '' if op >= 1 else ' android:fillAlpha="%g"' % op
        lines.append(ind + '<path android:fillColor="%s"%s android:pathData="%s" />' % (col, alpha, d))
    if only_glyph:
        # the white K and the spark of the mark, nothing else (monochrome / themed icon)
        for el in root.iter():
            if el.tag == SVG + 'path' and el.get('fill') == 'rgb(255, 255, 255)' and el.get('d', '').startswith('M83'):
                lines.append('        <path android:fillColor="%s" android:pathData="%s" />' % (mono, el.get('d')))
        lines.append('        <path android:fillColor="%s" android:pathData="M263,83h30v30h-30z" />' % mono)
    else:
        for k in root:
            walk(k, 2, False)
    vx, vy, vw, vh = view
    head = ['<?xml version="1.0" encoding="utf-8"?>',
            '<!-- KonMinli, the KonMin mark. Generated from branding/konmin-logo.svg by scripts/gen_konmin_icons.py; do not edit by hand. -->',
            '<vector xmlns:android="http://schemas.android.com/apk/res/android" xmlns:aapt="http://schemas.android.com/aapt"',
            '    android:width="%gdp" android:height="%gdp" android:viewportWidth="%g" android:viewportHeight="%g">' % (size_dp, size_dp, vw, vh),
            '    <group android:translateX="%g" android:translateY="%g">' % (-vx, -vy)]
    open(out, 'w').write('\n'.join(head + lines + ['    </group>', '</vector>', '']))



def main():
    convert(L, os.path.join(RES, 'drawable', 'ic_brand_logo.xml'), (-48, -54, 472, 472), 376)
    convert(L, os.path.join(RES, 'drawable', 'ic_launcher_glyph.xml'), (-94, -94, 564, 564), 108, drop_tile=True)
    convert(L, os.path.join(RES, 'drawable', 'ic_launcher_mono.xml'), (-94, -94, 564, 564), 108, mono='#FFFFFFFF', only_glyph=True)
    raster(RES)

def raster(OUT):
    svg = open(L).read()
    # the mark without its tile (adaptive layers): drop the tile, its bevels and its rim
    TILE_PATHS = ('M84 0H292', 'M32.04', 'M18 32.04', 'M358 32.04', 'M19.66')
    def strip_tile(s):
        return re.sub(r'<path d="(%s)[^"]*"[^>]*></path>' % '|'.join(re.escape(p) for p in TILE_PATHS), '', s)
    content = strip_tile(svg)
    inner = re.search(r'<svg[^>]*>(.*)</svg>', content, re.S).group(1)
    def layer(a, b):
        return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-94 -94 564 564">'
                '<defs><linearGradient id="g" x1="-94" y1="-94" x2="470" y2="470" gradientUnits="userSpaceOnUse">'
                '<stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient></defs>'
                '<rect x="-94" y="-94" width="564" height="564" fill="url(#g)"/>%s</svg>') % (a, b, inner)
    def render(text, px, path):
        png = subprocess.run(['rsvg-convert', '-w', str(px), '-h', str(px)], input=text.encode(), stdout=subprocess.PIPE, check=True).stdout
        open(path, 'wb').write(png)
    dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
    for d, k in dens.items():
        os.makedirs(f'{OUT}/mipmap-{d}', exist_ok=True)
        render(svg, int(48 * k), f'{OUT}/mipmap-{d}/ic_launcher.png')
        render(svg, int(48 * k), f'{OUT}/mipmap-{d}/ic_launcher_round.png')
        render(layer('#3D8BFF', '#7B5CFF'), int(108 * k), f'{OUT}/mipmap-{d}/ic_launcher_foreground.png')
    ALTS = {'spark': ('#0e7490', '#22d3ee'), 'flame': ('#e2531f', '#f59e0b'), 'amethyst': ('#6d28d9', '#a855f7'),
            'legend': ('#1e3a8a', '#4338ca'), 'gold': ('#d97706', '#facc15'), 'diamond': ('#0ea5e9', '#67e8f9')}
    for name, (a, b) in ALTS.items():
        for d in ('xhdpi', 'xxhdpi', 'xxxhdpi'):
            p = f'{OUT}/mipmap-{d}/ic_launcher_{name}_layer'
            render(layer(a, b), int(108 * dens[d]), p + '.png')
            subprocess.run(['convert', p + '.png', '-quality', '95', p + '.webp'], check=True); os.remove(p + '.png')
    print('ok')


if __name__ == '__main__':
    main()
