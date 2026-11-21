# Building KonMin Launcher Mobile

Russian version of the original guide: [BUILDING.ru.md](BUILDING.ru.md) (it describes the upstream
project; the KonMin specifics are below).

## A. In the cloud, from a phone (no computer needed)

The repository has a GitHub Actions workflow, [`.github/workflows/android.yml`](.github/workflows/android.yml),
that builds the APK on GitHub's servers.

1. Open the repository on github.com in your phone's browser (or the GitHub app) and sign in.
2. Make sure Actions are enabled: **Settings → Actions → General → Allow all actions**.
3. Start a build in one of two ways:
   - push any commit to the `konmin-mobile` branch, or
   - open **Actions → Android APK → Run workflow**, pick the `konmin-mobile` branch, tap **Run workflow**.
4. Wait for the green check (about 15–25 minutes: the first step downloads the Android SDK and assembles
   the Java/graphics runtime pack).
5. Open the run, scroll to **Artifacts**, download **KonMin-Launcher-Mobile**. It is a zip: open it
   with your file manager and install `KonMin-Launcher-Mobile-debug.apk`.

To publish a Release (a permanent download link), create a tag that starts with `v`, for example
`v1.0.0`, on the `konmin-mobile` branch (**Code → Tags/Releases → Create a new release → Choose a tag →
v1.0.0 → Publish**, or `git tag v1.0.0 && git push origin v1.0.0`). The workflow then attaches the APK and
its SHA-256 to that Release.

### Optional repository settings

| Where | Name | What for |
| --- | --- | --- |
| Settings → Secrets and variables → Actions → **Variables** | `KONMIN_MS_CLIENT_ID` | Your Microsoft Entra ID application id: turns on Microsoft (licensed) sign-in. It is public, not a secret. |
| … → **Secrets** | `KONMIN_KEYSTORE_BASE64`, `KONMIN_KEYSTORE_PASSWORD`, `KONMIN_KEY_ALIAS`, `KONMIN_KEY_PASSWORD` | Your own release signing key (base64 of the `.jks` file). With them the workflow also builds a signed `KonMin-Launcher-Mobile.apk`. |

Never use somebody else's signing key: Android identifies the publisher by it and refuses to update an app
signed by a different key. Keep the keystore file and its passwords safe; losing them means users must
uninstall and reinstall to get updates.

## B. On a computer

Requirements: JDK 17+, Android SDK with **platform 35**, **build-tools 35.0.0**, **NDK 27.0.12077973**,
**CMake 3.22.1**, Python 3. Android Studio installs all of them ("SDK Manager"), or:

```bash
sdkmanager "platforms;android-35" "build-tools;35.0.0" "ndk;27.0.12077973" "cmake;3.22.1"
```

Tell Gradle where the SDK is (`ANDROID_HOME`, or `sdk.dir=…` in `local.properties`), then:

```bash
./gradlew :bridge:jar
python3 scripts/make_konmin_runtime.py
./gradlew :app:assembleDebug -Pmillida.bundleRuntime -Pmillida.runtimeArchive=../dist/konmin-runtime-arm64.zip
```

The APK is `app/build/outputs/apk/debug/app-debug.apk` (package `net.konmin.launcher.mobile`).

- Without the two runtime steps and `-Pmillida.bundleRuntime`, you get a small APK (~45 MB) without the
  Java/graphics pack: it starts, but a game can only run after a pack is imported in Settings.
- Signed release: put your key in `local.properties` (`konmin.release.keystore`, `konmin.release.password`,
  `konmin.release.alias`, `konmin.release.key.password`) or the `KONMIN_KEYSTORE_*` environment variables
  and run `./gradlew :app:assembleRelease` with the same `-P` flags. Without a key the release APK is built
  unsigned.

### Open in Android Studio

**File → Open** → the repository folder → wait for the Gradle sync → pick the `app` configuration and a
64-bit ARM phone or emulator image. The first sync downloads several hundred MB of dependencies.

### Checks

```bash
./gradlew :core:test                         # core unit tests (JVM)
./gradlew :app:testDebugUnitTest             # app unit tests (Robolectric)
./gradlew :app:testDebugUnitTest --tests '*KonMinShotsTest*' -Pmillida.shots=shots   # screenshots of the six sections
```

On a machine whose locale is not UTF-8, set `LC_ALL=C.UTF-8` first: some upstream test names are in Russian.

## If it does not build

| Error | What to do |
| --- | --- |
| `SDK location not found` | Set `ANDROID_HOME` or `sdk.dir` in `local.properties` |
| `Android Gradle plugin requires Java 17` | Install JDK 17+ or point `JAVA_HOME` at it |
| NDK or CMake errors | Install NDK 27.0.12077973 and CMake 3.22.1 |
| `make_konmin_runtime.py`: sha256 mismatch | A source file changed upstream; do not bypass the check — update the pinned version deliberately |
| HTTP 429 from Maven Central | Temporary rate limit: run the build again |
