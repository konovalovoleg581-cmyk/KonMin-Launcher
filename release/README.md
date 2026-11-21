# release/

Built APKs go here (`KonMin-Launcher-Mobile-debug.apk`, plus `KonMin-Launcher-Mobile.apk` when a release key is
configured) together with `SHA256SUMS.txt`.

The APK itself (~210 MB, with the Java + graphics runtime pack inside) is larger than GitHub's 100 MB file limit,
so it is not committed. Get it from:

- **Actions** → latest green *Android APK* run → **Artifacts** → `KonMin-Launcher-Mobile`, or
- **Releases**, for tags `v*` (the workflow attaches the APK there).

To build it yourself see [../BUILDING.md](../BUILDING.md).
