import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { GameExit, Progress } from "./lib/api";
import { useApp, useTr, type Screen } from "./store";
import { TitleBar } from "./components/TitleBar";
import { Toasts } from "./components/Toasts";
import { LoginModal } from "./components/LoginModal";
import { InstanceEditor } from "./components/InstanceEditor";
import { ContentManager } from "./components/ContentManager";
import { InstallDialog } from "./components/InstallDialog";
import { CrashDialog, LogPanel } from "./components/LogPanel";
import { Lobby, TopBar } from "./screens/Lobby";
import { Wardrobe } from "./screens/Wardrobe";
import { Library } from "./screens/Library";
import { Catalog } from "./screens/Catalog";
import { ProjectPage } from "./screens/ProjectPage";
import { SettingsScreen } from "./screens/Settings";
import { Servers } from "./screens/Servers";

const NAV: { key: Screen; ru: string; en: string }[] = [
  { key: "lobby", ru: "Главная", en: "Home" },
  { key: "library", ru: "Библиотека", en: "Library" },
  { key: "catalog", ru: "Каталог", en: "Catalog" },
  { key: "wardrobe", ru: "Гардероб", en: "Wardrobe" },
];

export default function App() {
  const tr = useTr();
  const { screen, go, modal, init, setProgress, pushLog, setRunning, setCrash, toast, logOpen, setLogOpen } = useApp();

  useEffect(() => {
    init();
    const unsubs: Promise<() => void>[] = [
      listen<Progress>("progress", (e) => {
        const p = e.payload;
        setProgress(p);
        if (p.task.startsWith("launch:")) {
          const id = p.task.slice(7);
          const running = useApp.getState().running;
          if (p.stage === "running" && !running.includes(id)) setRunning([...running, id]);
          if (p.stage === "exited") setRunning(running.filter((r) => r !== id));
        }
      }),
      listen<{ instanceId: string; line: string }>("game-log", (e) => pushLog(e.payload.instanceId, e.payload.line)),
      listen<GameExit>("game-exit", (e) => {
        const g = e.payload;
        setRunning(useApp.getState().running.filter((r) => r !== g.instanceId));
        useApp.getState().refreshInstances();
        if (g.crashed) setCrash(g);
        else toast(tr("Игра закрыта", "Game closed"), "info");
      }),
    ];
    return () => {
      unsubs.forEach((u) => u.then((f) => f()));
    };
  }, []);

  return (
    <div className="app">
      <TitleBar />
      <div className="app-body">
        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.key} className={`nav-btn ${screen === n.key || (n.key === "catalog" && screen === "project") ? "on" : ""}`} onClick={() => go(n.key)}>
              {tr(n.ru, n.en)}
            </button>
          ))}
          <div className="grow" />
          <button className={`nav-btn ${logOpen ? "on" : ""}`} onClick={() => setLogOpen(logOpen ? null : useApp.getState().settings?.selectedInstance ?? useApp.getState().instances[0]?.id ?? null)}>
            {tr("Лог", "Log")}
          </button>
          <TopBar />
        </nav>
        <main className="screen" key={screen}>
          {screen === "lobby" && <Lobby />}
          {screen === "wardrobe" && <Wardrobe />}
          {screen === "library" && <Library />}
          {screen === "catalog" && <Catalog />}
          {screen === "project" && <ProjectPage />}
          {screen === "settings" && <SettingsScreen />}
          {screen === "servers" && <Servers />}
        </main>
        <LogPanel />
      </div>

      {modal?.type === "login" && <LoginModal />}
      {modal?.type === "editor" && <InstanceEditor instance={modal.instance} />}
      {modal?.type === "content" && <ContentManager instanceId={modal.instanceId} />}
      {modal?.type === "install" && <InstallDialog projectId={modal.projectId} projectType={modal.projectType} title={modal.title} versionId={modal.versionId} />}
      <CrashDialog />
      <Toasts />
    </div>
  );
}
