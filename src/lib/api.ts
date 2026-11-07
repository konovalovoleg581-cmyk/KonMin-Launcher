// Типы данных и обёртки над командами Rust-бэкенда (Tauri invoke).
import { invoke } from "@tauri-apps/api/core";

export interface Settings {
  ramMb: number;
  javaPath: string | null;
  language: "ru" | "en";
  afterLaunch: "minimize" | "close" | "keep";
  dataDir: string | null;
  selectedInstance: string | null;
  gameMode: "java" | "bedrock";
  clientToken: string;
  activeAccount: string | null;
  sound: boolean;
}

export interface SystemInfo {
  os: string;
  arch: string;
  version: string;
  dataDir: string;
}

export interface Account {
  id: string;
  name: string;
  kind: "ely" | "guest";
  login: string | null;
}

export type Loader = "vanilla" | "fabric" | "quilt" | "forge" | "neoforge";

export interface Instance {
  id: string;
  name: string;
  icon: string;
  mcVersion: string;
  loader: Loader;
  loaderVersion: string | null;
  versionId: string | null;
  ramMb: number | null;
  jvmArgs: string;
  javaPath: string | null;
  created: number;
  lastPlayed: number | null;
  modpack: { projectId: string; versionId: string } | null;
}

export interface NewInstance {
  name: string;
  icon: string;
  mcVersion: string;
  loader: Loader;
  loaderVersion: string | null;
  ramMb: number | null;
  jvmArgs: string;
  javaPath: string | null;
}

export interface ManifestVersion {
  id: string;
  type: "release" | "snapshot" | "old_beta" | "old_alpha" | string;
  url: string;
  releaseTime: string;
}

export interface LoaderVersion {
  version: string;
  stable: boolean;
}

export interface ContentFile {
  file: string;
  enabled: boolean;
  size: number;
  title: string | null;
  projectId: string | null;
  iconUrl: string | null;
}

export interface UpdateInfo {
  file: string;
  title: string;
  newVersionId: string;
  newVersionName: string;
}

export interface Progress {
  task: string;
  stage: string;
  text: string;
  current: number;
  total: number;
}

export interface GameExit {
  instanceId: string;
  code: number | null;
  crashReport: string | null;
  crashed: boolean;
}

export interface Textures {
  skin: string | null;
  cape: string | null;
  slim: boolean;
}

export interface LocalSkin {
  id: string;
  name: string;
  slim: boolean;
  dataUrl: string;
}

export interface BedrockStatus {
  supported: boolean;
  installed: boolean;
  version: string | null;
}

// --- Modrinth ---
export interface SearchHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  downloads: number;
  follows: number;
  icon_url: string | null;
  featured_gallery: string | null;
  gallery: string[];
  project_type: string;
  categories: string[];
  display_categories?: string[];
  versions: string[];
  latest_version: string;
  client_side: string;
  server_side: string;
}

export interface SearchResult {
  hits: SearchHit[];
  offset: number;
  limit: number;
  total_hits: number;
}

export interface MrProject {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  project_type: string;
  downloads: number;
  followers: number;
  icon_url: string | null;
  categories: string[];
  loaders: string[];
  game_versions: string[];
  gallery: { url: string; title: string | null; description: string | null; featured: boolean }[];
  source_url: string | null;
  issues_url: string | null;
  wiki_url: string | null;
  discord_url: string | null;
  team: string;
}

export interface MrVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  version_type: string;
  date_published: string;
  downloads: number;
  loaders: string[];
  game_versions: string[];
  dependencies: { project_id: string | null; version_id: string | null; dependency_type: string }[];
  files: { url: string; filename: string; primary: boolean; size: number }[];
}

export interface MrCategory {
  name: string;
  project_type: string;
  header: string;
  icon: string;
}

export const api = {
  getSettings: () => invoke<Settings>("get_settings"),
  saveSettings: (settings: Settings) => invoke<Settings>("save_settings", { settings }),
  systemInfo: () => invoke<SystemInfo>("system_info"),
  openUrl: (url: string) => invoke<void>("open_url", { url }),
  openDataFolder: () => invoke<void>("open_data_folder"),

  listAccounts: () => invoke<{ accounts: Account[]; active: string | null }>("list_accounts"),
  elyLogin: (login: string, password: string, totp: string | null) =>
    invoke<{ status: "ok" | "need2fa"; account: Account | null }>("ely_login", { login, password, totp }),
  addGuest: (name: string) => invoke<Account>("add_guest", { name }),
  setActiveAccount: (id: string) => invoke<void>("set_active_account", { id }),
  logout: (id: string) => invoke<void>("logout", { id }),

  versionManifest: () => invoke<{ latest: { release: string; snapshot: string }; versions: ManifestVersion[] }>("get_version_manifest"),
  loaderVersions: (loader: Loader, mc: string) => invoke<LoaderVersion[]>("get_loader_versions", { loader, mc }),

  listInstances: () => invoke<Instance[]>("list_instances"),
  createInstance: (input: NewInstance) => invoke<Instance>("create_instance", { input }),
  updateInstance: (instance: Instance) => invoke<Instance>("update_instance", { instance }),
  deleteInstance: (id: string) => invoke<void>("delete_instance", { id }),
  duplicateInstance: (id: string) => invoke<Instance>("duplicate_instance", { id }),
  openInstanceFolder: (id: string, sub?: string) => invoke<void>("open_instance_folder", { id, sub: sub ?? null }),
  listContent: (id: string, kind: string) => invoke<ContentFile[]>("list_instance_content", { id, kind }),
  toggleContent: (id: string, kind: string, file: string) => invoke<void>("toggle_content", { id, kind, file }),
  deleteContent: (id: string, kind: string, file: string) => invoke<void>("delete_content", { id, kind, file }),
  exportMrpack: (id: string) => invoke<string>("export_mrpack", { id }),

  launch: (id: string) => invoke<void>("launch_instance", { id }),
  kill: (id: string) => invoke<void>("kill_game", { id }),
  runningGames: () => invoke<string[]>("running_games"),
  openCrashReport: (path: string) => invoke<void>("open_crash_report", { path }),

  modrinth: <T>(path: string, query?: [string, string][]) => invoke<T>("modrinth_get", { path, query: query ?? null }),
  installProject: (instanceId: string, projectId: string, versionId: string | null, taskId: string) =>
    invoke<{ installed: string[] }>("install_project", { instanceId, projectId, versionId, taskId }),
  installModpackVersion: (versionId: string, taskId: string) =>
    invoke<Instance>("install_modpack_version", { versionId, taskId }),
  importMrpack: (path: string, taskId: string) => invoke<Instance>("import_mrpack", { path, taskId }),
  checkUpdates: (instanceId: string) => invoke<UpdateInfo[]>("check_updates", { instanceId }),
  applyUpdate: (instanceId: string, file: string, versionId: string) =>
    invoke<void>("apply_update", { instanceId, file, versionId }),

  bedrockStatus: () => invoke<BedrockStatus>("bedrock_status"),
  launchBedrock: () => invoke<void>("launch_bedrock"),
  openBedrockStore: () => invoke<void>("open_bedrock_store"),

  elyTextures: (nick: string) => invoke<Textures>("get_ely_textures", { nick }),
  localSkins: () => invoke<LocalSkin[]>("list_local_skins"),
  importSkin: (path: string, name: string | null, slim: boolean) => invoke<LocalSkin>("import_skin", { path, name, slim }),
  deleteSkin: (id: string) => invoke<void>("delete_local_skin", { id }),
  prepareElyUpload: (id: string | null) => invoke<string | null>("prepare_ely_upload", { id }),
};

export function errText(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export const LOADER_NAMES: Record<Loader, string> = {
  vanilla: "Vanilla",
  fabric: "Fabric",
  quilt: "Quilt",
  forge: "Forge",
  neoforge: "NeoForge",
};

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export function newTaskId(prefix: string): string {
  return `${prefix}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
