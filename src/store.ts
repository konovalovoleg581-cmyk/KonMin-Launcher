// Глобальное состояние приложения (Zustand).
import { create } from "zustand";
import { api, errText, type Account, type GameExit, type Instance, type Progress, type Settings, type SystemInfo, type Textures } from "./lib/api";

export type Screen = "lobby" | "wardrobe" | "library" | "catalog" | "project" | "settings" | "servers";

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "ok" | "error";
}

export type Modal =
  | { type: "login" }
  | { type: "editor"; instance?: Instance }
  | { type: "content"; instanceId: string }
  | { type: "install"; projectId: string; projectType: string; title: string; versionId?: string }
  | null;

interface AppState {
  screen: Screen;
  prevScreen: Screen;
  projectId: string | null;
  go: (s: Screen) => void;
  openProject: (id: string) => void;

  settings: Settings | null;
  sys: SystemInfo | null;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;

  accounts: Account[];
  activeId: string | null;
  refreshAccounts: () => Promise<void>;
  textures: Textures;
  refreshTextures: () => Promise<void>;

  instances: Instance[];
  refreshInstances: () => Promise<void>;

  progress: Record<string, Progress>;
  setProgress: (p: Progress) => void;
  clearProgress: (task: string) => void;

  logs: Record<string, string[]>;
  pushLog: (id: string, line: string) => void;
  clearLog: (id: string) => void;
  logOpen: string | null;
  setLogOpen: (id: string | null) => void;
  running: string[];
  setRunning: (ids: string[]) => void;
  crash: GameExit | null;
  setCrash: (c: GameExit | null) => void;

  toasts: Toast[];
  toast: (text: string, kind?: Toast["kind"]) => void;
  dismiss: (id: number) => void;
  notifications: Toast[];

  modal: Modal;
  setModal: (m: Modal) => void;
  init: () => Promise<void>;
}

let toastSeq = 1;
const MAX_LOG = 3000;

export const useApp = create<AppState>((set, get) => ({
  screen: "lobby",
  prevScreen: "lobby",
  projectId: null,
  go: (s) => set((st) => ({ screen: s, prevScreen: st.screen === s ? st.prevScreen : st.screen })),
  openProject: (id) => set((st) => ({ projectId: id, screen: "project", prevScreen: st.screen === "project" ? st.prevScreen : st.screen })),

  settings: null,
  sys: null,
  updateSettings: async (patch) => {
    const cur = get().settings;
    if (!cur) return;
    const next = { ...cur, ...patch };
    set({ settings: next });
    try {
      const saved = await api.saveSettings(next);
      set({ settings: saved });
    } catch (e) {
      get().toast(errText(e), "error");
    }
  },

  accounts: [],
  activeId: null,
  refreshAccounts: async () => {
    const r = await api.listAccounts();
    set({ accounts: r.accounts, activeId: r.active });
    await get().refreshTextures();
  },
  textures: { skin: null, cape: null, slim: false },
  refreshTextures: async () => {
    const { accounts, activeId } = get();
    const acc = accounts.find((a) => a.id === activeId);
    if (!acc || acc.kind !== "ely") {
      set({ textures: { skin: null, cape: null, slim: false } });
      return;
    }
    try {
      set({ textures: await api.elyTextures(acc.name) });
    } catch {
      /* skinsystem недоступен — оставляем стандартный скин */
    }
  },

  instances: [],
  refreshInstances: async () => {
    try {
      set({ instances: await api.listInstances() });
    } catch (e) {
      get().toast(errText(e), "error");
    }
  },

  progress: {},
  setProgress: (p) => set((st) => ({ progress: { ...st.progress, [p.task]: p } })),
  clearProgress: (task) =>
    set((st) => {
      const next = { ...st.progress };
      delete next[task];
      return { progress: next };
    }),

  logs: {},
  pushLog: (id, line) =>
    set((st) => {
      const cur = st.logs[id] ?? [];
      const next = cur.length >= MAX_LOG ? cur.slice(cur.length - MAX_LOG + 1) : cur.slice();
      next.push(line);
      return { logs: { ...st.logs, [id]: next } };
    }),
  clearLog: (id) => set((st) => ({ logs: { ...st.logs, [id]: [] } })),
  logOpen: null,
  setLogOpen: (id) => set({ logOpen: id }),
  running: [],
  setRunning: (ids) => set({ running: ids }),
  crash: null,
  setCrash: (c) => set({ crash: c }),

  toasts: [],
  notifications: [],
  toast: (text, kind = "info") => {
    const t = { id: toastSeq++, text, kind };
    set((st) => ({ toasts: [...st.toasts, t], notifications: [t, ...st.notifications].slice(0, 30) }));
    setTimeout(() => get().dismiss(t.id), kind === "error" ? 7000 : 3500);
  },
  dismiss: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),

  modal: null,
  setModal: (m) => set({ modal: m }),

  init: async () => {
    try {
      const [settings, sys] = await Promise.all([api.getSettings(), api.systemInfo()]);
      set({ settings, sys });
      await Promise.all([get().refreshAccounts(), get().refreshInstances()]);
      set({ running: await api.runningGames() });
    } catch (e) {
      get().toast(errText(e), "error");
    }
  },
}));

/** Перевод: tr("Играть", "Play") — по языку из настроек. */
export function useTr() {
  const lang = useApp((s) => s.settings?.language ?? "ru");
  return (ru: string, en: string) => (lang === "en" ? en : ru);
}
