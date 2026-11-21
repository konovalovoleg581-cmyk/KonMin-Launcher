"""Builds the KonMin runtime pack (Java + graphics) from public, hash-pinned sources only.

The upstream project served its pack from Millida's storage. KonMin Launcher Mobile builds its own:

  1. ZalithLauncher2 2.4.11 for arm64 (GPL-3.0, GitHub release) gives Java 21 and 25, the renderers
     (Krypton / GL4ES, ANGLE, Mesa) and the LWJGL / GLFW layer: scripts/make_bundle.py takes them out.
  2. bridge/ of this repository (GPL-3.0-only) gives millida-glfw.jar (`./gradlew :bridge:jar`).
  3. OpenJDK 8 for Android arm64 (GPL-2.0 with the Classpath Exception, AngelAuraMC build on GitHub)
     is added as jre-8, so Minecraft 1.16 and older start too. Upstream downloads it as a component
     from Millida's storage instead.

Every download is checked against its SHA-256 before use. The result is dist/konmin-runtime-arm64.zip,
which `./gradlew :app:assembleDebug -Pmillida.bundleRuntime -Pmillida.runtimeArchive=../dist/konmin-runtime-arm64.zip`
puts inside the APK, so the launcher needs no server to start the game.

Usage (needs Python 3, ~400 MB of free disk, network access to github.com):

    ./gradlew :bridge:jar
    python3 scripts/make_konmin_runtime.py
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_runtime_components import unpack_tar  # noqa: E402

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.environ.get('KONMIN_RUNTIME_SRC', os.path.join(tempfile.gettempdir(), 'konmin-runtime'))
OUT = os.path.join(PROJECT, 'dist', 'konmin-runtime-arm64.zip')

SOURCES = {
    'zl2': {
        'url': 'https://github.com/ZalithLauncher/ZalithLauncher2/releases/download/2.4.11/ZalithLauncher-2.4.11-arm64-v8a.apk',
        'sha256': 'b19adc0acdfeafad950637cc4ae9091ec296f3917d1d5d15be7635c9f6ff8b84',
        'file': 'zl2-2.4.11-arm64-v8a.apk',
    },
    'jre8': {
        'url': 'https://github.com/AngelAuraMC/angelauramc-openjdk-build/releases/download/download_jre8/jre8-android-arm64.tar.xz',
        'sha256': '9a59124d9791957d55c68be664ab76831f336cf2e1e1cd4414220c6fdbf0e06d',
        'file': 'jre8-android-arm64.tar.xz',
    },
}

NOTICE = """KonMin Launcher Mobile runtime pack (arm64-v8a)
Built by scripts/make_konmin_runtime.py of KonMin Launcher Mobile (GPL-3.0-only) from these sources:

- ZalithLauncher2 2.4.11 (GPL-3.0): {zl2_url}
  sha256 {zl2_sha}. Source: https://github.com/ZalithLauncher/ZalithLauncher2/tree/2.4.11
  Java 21 and 25 (OpenJDK, GPL-2.0 with the Classpath Exception), the window layer libpojavexec
  (PojavLauncher / ZalithLauncher2, GPL-3.0 / LGPL-3.0), gl4es (MIT), NG-GL4ES / Krypton Wrapper (MIT),
  OpenAL Soft (LGPL-2.0-or-later), LWJGL 3.3.6 (BSD-3-Clause), ANGLE (BSD-3-Clause), Mesa (MIT),
  FreeType, JNA, bytehook and libc++ under their own licenses (see THIRD-PARTY.md of the launcher).
  libpojavexec.so is modified by scripts/make_runtime_components.py: it reads the renderer from
  MILLIDA_RENDER instead of POJAV_RENDERER.
- OpenJDK 8 for Android arm64 (GPL-2.0 with the Classpath Exception), AngelAuraMC build: {jre8_url}
  sha256 {jre8_sha}. Build scripts: https://github.com/AngelAuraMC/angelauramc-openjdk-build
  LICENSE, ASSEMBLY_EXCEPTION and THIRD_PARTY_README are inside jre-8/.
- bridge/millida-glfw.jar: bridge/ of KonMin Launcher Mobile / Millida Launcher Mobile, GPL-3.0-only.

The corresponding source of every GPL component is at the addresses above; the launcher's own source
is the repository this pack was built from.
"""


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def fetch(source):
    os.makedirs(WORK, exist_ok=True)
    path = os.path.join(WORK, source['file'])
    if not os.path.isfile(path) or sha256(path) != source['sha256']:
        print('downloading', source['url'])
        partial = path + '.part'
        with urllib.request.urlopen(source['url'], timeout=600) as response, open(partial, 'wb') as out:
            shutil.copyfileobj(response, out, 1 << 20)
        os.replace(partial, path)
    actual = sha256(path)
    if actual != source['sha256']:
        sys.exit('sha256 mismatch for %s: %s' % (source['url'], actual))
    return path


def main():
    glfw = os.path.join(PROJECT, 'bridge', 'build', 'libs', 'millida-glfw.jar')
    if not os.path.isfile(glfw):
        sys.exit('bridge/build/libs/millida-glfw.jar is missing: run ./gradlew :bridge:jar first')
    zl2 = fetch(SOURCES['zl2'])
    jre8 = fetch(SOURCES['jre8'])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    env = dict(os.environ, MILLIDA_RUNTIME_SRC=WORK)
    subprocess.run([sys.executable, os.path.join(PROJECT, 'scripts', 'make_bundle.py'),
                    '--abi', 'arm64-v8a', '--apk', zl2, '--out', OUT, '--glfw-jar', glfw], check=True, env=env)

    unpacked = os.path.join(WORK, 'jre-8')
    if os.path.isdir(unpacked):
        shutil.rmtree(unpacked)
    unpack_tar(jre8, unpacked)

    rebuilt = OUT + '.tmp'
    with zipfile.ZipFile(OUT) as source, zipfile.ZipFile(rebuilt, 'w', zipfile.ZIP_DEFLATED) as target:
        for item in source.infolist():
            data = source.read(item.filename)
            if item.filename == 'millida-runtime.json':
                description = json.loads(data)
                description['name'] = 'konmin-runtime-arm64'
                jres = [j for j in description['jres'] if j['major'] != 8]
                description['jres'] = [{'major': 8, 'path': 'jre-8'}] + jres
                data = json.dumps(description, ensure_ascii=False, indent=2).encode('utf-8')
            target.writestr(item, data)
        for folder, _, files in os.walk(unpacked):
            for name in sorted(files):
                full = os.path.join(folder, name)
                arc = 'jre-8/' + os.path.relpath(full, unpacked).replace(os.sep, '/')
                info = zipfile.ZipInfo(arc, date_time=(1981, 1, 1, 1, 1, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = (os.stat(full).st_mode & 0o777 | 0o100000) << 16
                with open(full, 'rb') as handle:
                    target.writestr(info, handle.read())
        target.writestr('NOTICE-KONMIN.txt', NOTICE.format(
            zl2_url=SOURCES['zl2']['url'], zl2_sha=SOURCES['zl2']['sha256'],
            jre8_url=SOURCES['jre8']['url'], jre8_sha=SOURCES['jre8']['sha256']))
    os.replace(rebuilt, OUT)
    print('pack:', OUT, '%.1f MB' % (os.path.getsize(OUT) / 1048576), 'sha256', sha256(OUT))


if __name__ == '__main__':
    main()
