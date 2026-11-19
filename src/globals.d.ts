// Injected by vite.config.ts from what actually lies in media/ at build time.
declare const __BUNDLED_VIDEOS__: string[]
declare const __HAS_BUNDLED_MUSIC__: boolean
// true only in a MEDIA_REMOTE=1 build: the big media is downloaded by the core instead of riding in the build.
declare const __MEDIA_REMOTE__: boolean
/** Set by vite.config.ts: tauri.conf.json names this build's own update channel. */
declare const __KONMIN_UPDATES__: boolean
/** Set by vite.config.ts: usage statistics are sent only after the player turns them on. */
declare const __KONMIN_TELEMETRY_OPT_IN__: boolean
