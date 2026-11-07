// Экран 1 — Лобби.
import { useEffect, useRef, useState } from "react";
import { api, errText, LOADER_NAMES, type BedrockStatus } from "../lib/api";
import { click } from "../lib/sound";
import { useApp, useTr } from "../store";
import { PixelIcon } from "../components/PixelIcon";
import { ProfileMenu } from "../components/ProfileMenu";
import { SkinViewer } from "../components/SkinViewer";

export function TopBar() {
  const tr = useTr();
  const { settings, updateSettings, notifications, go } = useApp();
  const [bell, setBell] = useState(false);
  return (
    <div className="topbar">
      <div className="friends panel" title={tr("Друзья появятся в следующих версиях", "Friends are coming soon")}>
        <PixelIcon name="heart" size={18} />
        <span>{tr("Друзья", "Friends")}</span>
        <span className="online-dot" />
        <span className="muted small">0 {tr("в сети", "online")} · {tr("скоро", "soon")}</span>
      </div>
      <ProfileMenu />
      <button className="icon-btn square" title={tr("Звук", "Sound")} onClick={() => updateSettings({ sound: !settings?.sound })}>
        {settings?.sound ? "🔊" : "🔇"}
      </button>
      <div className="profile">
        <button className="icon-btn square" title={tr("Уведомления", "Notifications")} onClick={() => setBell(!bell)}>
          🔔{notifications.length > 0 && <span className="badge">{Math.min(9, notifications.length)}</span>}
        </button>
        {bell && (
          <div className="dropdown panel notif">
            {notifications.length === 0 && <div className="muted small pad">{tr("Нет уведомлений", "No notifications")}</div>}
            {notifications.map((n) => (
              <div key={n.id} className={`notif-item ${n.kind}`}>{n.text}</div>
            ))}
          </div>
        )}
      </div>
      <button className="icon-btn square" title={tr("Настройки", "Settings")} onClick={() => go("settings")}>⚙</button>
    </div>
  );
}

export function Lobby() {
  const tr = useTr();
  const { go, settings, updateSettings, instances, accounts, activeId, textures, progress, running, setModal, toast, clearLog, setLogOpen, sys } = useApp();
  const [picker, setPicker] = useState(false);
  const [bedrock, setBedrock] = useState<BedrockStatus | null>(null);
  const [walk, setWalk] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const mode = settings?.gameMode ?? "java";
  const inst = instances.find((i) => i.id === settings?.selectedInstance) ?? instances[0];
  const account = accounts.find((a) => a.id === activeId);
  const isWindows = sys?.os === "windows";
  const p = inst ? progress[`launch:${inst.id}`] : undefined;
  const isRunning = inst ? running.includes(inst.id) : false;
  const launching = !!p && !["running", "error", "exited"].includes(p.stage) && !isRunning;

  useEffect(() => {
    if (mode === "bedrock") api.bedrockStatus().then(setBedrock).catch(() => setBedrock(null));
  }, [mode]);

  useEffect(() => {
    const h = (e: MouseEvent) => pickerRef.current && !pickerRef.current.contains(e.target as Node) && setPicker(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const play = async () => {
    click(!!settings?.sound, 880);
    if (mode === "bedrock") {
      try {
        if (bedrock?.installed) await api.launchBedrock();
        else await api.openBedrockStore();
      } catch (e) {
        toast(errText(e), "error");
      }
      return;
    }
    if (!account) return setModal({ type: "login" });
    if (!inst) return setModal({ type: "editor" });
    if (isRunning) return setLogOpen(inst.id);
    clearLog(inst.id);
    try {
      await api.launch(inst.id);
    } catch (e) {
      toast(errText(e), "error");
    }
  };

  const pct = p && p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;

  return (
    <div className="lobby">
      <aside className="lobby-left">
        <button className="side-card c1" onClick={() => go("catalog")}>
          <PixelIcon name="chest" size={56} />
          <span className="pixel-title small">{tr("Каталог", "Catalog")}</span>
          <span className="muted small">{tr("Моды, сборки, шейдеры", "Mods, packs, shaders")}</span>
        </button>
        <button className="side-card c2" onClick={() => go("wardrobe")}>
          <PixelIcon name="user" size={56} />
          <span className="pixel-title small">{tr("Мой скин", "My skin")}</span>
          <span className="muted small">{tr("Гардероб", "Wardrobe")}</span>
        </button>
        <button className="side-card c3" onClick={() => go("servers")}>
          <PixelIcon name="globe" size={56} />
          <span className="pixel-title small">{tr("С друзьями", "With friends")}</span>
          <span className="muted small">{tr("Серверы", "Servers")}</span>
        </button>
      </aside>

      <div className="lobby-center" onMouseEnter={() => setWalk(true)} onMouseLeave={() => setWalk(false)}>
        <div className="avatar-glow" />
        <SkinViewer skin={textures.skin} cape={textures.cape} slim={textures.slim} walking={walk} />
        <div className="nameplate">{account?.name ?? tr("Не выполнен вход", "Not signed in")}</div>
      </div>

      <div className="lobby-bottom">
        <div className="seg mode-toggle">
          <button className={mode === "java" ? "on" : ""} onClick={() => updateSettings({ gameMode: "java" })}>Java</button>
          <button
            className={mode === "bedrock" ? "on" : ""}
            disabled={!isWindows}
            title={isWindows ? "" : tr("Bedrock доступна только на Windows", "Bedrock is Windows-only")}
            onClick={() => updateSettings({ gameMode: "bedrock" })}
          >
            Bedrock
          </button>
        </div>

        <div className="selector" ref={pickerRef}>
          <button className="selector-card panel" onClick={() => mode === "java" && setPicker(!picker)}>
            {mode === "bedrock" ? (
              <>
                <PixelIcon name="bedrock" size={40} />
                <div className="sel-text">
                  <div className="muted small">{tr("Сегодня играем:", "Today we play:")}</div>
                  <div className="sel-name">Minecraft Bedrock</div>
                  <div className="muted small">
                    {bedrock === null ? "..." : bedrock.installed ? `${tr("Установлена", "Installed")} ${bedrock.version ?? ""}` : tr("Не установлена", "Not installed")}
                  </div>
                </div>
              </>
            ) : inst ? (
              <>
                <PixelIcon name={inst.icon} size={40} />
                <div className="sel-text">
                  <div className="muted small">{tr("Сегодня играем:", "Today we play:")}</div>
                  <div className="sel-name">{inst.name}</div>
                  <div className="muted small">{LOADER_NAMES[inst.loader]} · {inst.mcVersion}</div>
                </div>
                <span className="caret">▴</span>
              </>
            ) : (
              <div className="sel-text">
                <div className="sel-name">{tr("Нет сборок", "No instances")}</div>
                <div className="muted small">{tr("Создайте первую", "Create the first one")}</div>
              </div>
            )}
          </button>
          {picker && (
            <div className="picker panel">
              {instances.map((i) => (
                <button
                  key={i.id}
                  className={`pick ${i.id === inst?.id ? "on" : ""}`}
                  onClick={() => {
                    updateSettings({ selectedInstance: i.id });
                    setPicker(false);
                  }}
                >
                  <PixelIcon name={i.icon} size={28} />
                  <div>
                    <div>{i.name}</div>
                    <div className="muted small">{LOADER_NAMES[i.loader]} · {i.mcVersion}</div>
                  </div>
                  {running.includes(i.id) && <span className="tag">▶</span>}
                </button>
              ))}
              <button className="pick add" onClick={() => { setPicker(false); setModal({ type: "editor" }); }}>+ {tr("Новая сборка", "New instance")}</button>
              {isWindows && (
                <button className="pick" onClick={() => { setPicker(false); updateSettings({ gameMode: "bedrock" }); }}>
                  <PixelIcon name="bedrock" size={28} /> Minecraft Bedrock
                </button>
              )}
              <button className="pick" onClick={() => { setPicker(false); go("library"); }}>{tr("Все сборки →", "All instances →")}</button>
            </div>
          )}
        </div>

        <button className={`play-btn ${isRunning ? "running" : ""}`} onClick={play} disabled={launching}>
          {launching ? (
            <>
              <span className="play-fill" style={{ width: `${pct}%` }} />
              <span className="play-label small">{p?.text}{p && p.total > 1 ? ` ${pct}%` : ""}</span>
            </>
          ) : isRunning ? (
            <span className="play-label">{tr("Запущено", "Running")}</span>
          ) : mode === "bedrock" && bedrock && !bedrock.installed ? (
            <span className="play-label small">{tr("Открыть в Store", "Open in Store")}</span>
          ) : (
            <span className="play-label">{tr("Играть", "Play")}</span>
          )}
        </button>
      </div>

      {mode === "bedrock" && (
        <div className="bedrock-note panel small">
          {tr(
            "Bedrock запускается через Microsoft Store и использует аккаунт Microsoft/Xbox. Вход Ely.by, моды Modrinth и выбор версии для Bedrock не поддерживаются.",
            "Bedrock runs via the Microsoft Store and uses a Microsoft/Xbox account. Ely.by, Modrinth mods and version switching are not supported for Bedrock.",
          )}
        </div>
      )}
      {mode === "java" && p?.stage === "error" && <div className="launch-error panel small">{p.text}</div>}
    </div>
  );
}
