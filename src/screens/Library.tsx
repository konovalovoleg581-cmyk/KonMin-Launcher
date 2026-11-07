// Экран 3 — Библиотека сборок.
import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api, errText, LOADER_NAMES, newTaskId, type Instance, type SearchResult } from "../lib/api";
import { useApp, useTr } from "../store";
import { PixelIcon } from "../components/PixelIcon";
import { ProgressBar } from "../components/Modal";
import { ProjectCard } from "./Catalog";

export function Library() {
  const tr = useTr();
  const { instances, refreshInstances, setModal, toast, go, updateSettings, running, progress, clearLog } = useApp();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState<{ inst: Instance; x: number; y: number } | null>(null);
  const [recommended, setRecommended] = useState<SearchResult | null>(null);
  const [importTask, setImportTask] = useState<string | null>(null);

  useEffect(() => {
    refreshInstances();
    api
      .modrinth<SearchResult>("/search", [
        ["index", "downloads"],
        ["limit", "8"],
        ["facets", JSON.stringify([["project_type:modpack"]])],
      ])
      .then(setRecommended)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const list = instances.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()) || i.mcVersion.includes(q));

  const act = async (action: string, inst: Instance) => {
    setMenu(null);
    try {
      switch (action) {
        case "play":
          await updateSettings({ selectedInstance: inst.id, gameMode: "java" });
          clearLog(inst.id);
          go("lobby");
          await api.launch(inst.id);
          break;
        case "folder":
          await api.openInstanceFolder(inst.id);
          break;
        case "mods":
          setModal({ type: "content", instanceId: inst.id });
          break;
        case "settings":
          setModal({ type: "editor", instance: inst });
          break;
        case "duplicate":
          await api.duplicateInstance(inst.id);
          await refreshInstances();
          break;
        case "export": {
          const path = await api.exportMrpack(inst.id);
          toast(tr(`Экспортировано: ${path}`, `Exported: ${path}`), "ok");
          break;
        }
        case "delete":
          if (running.includes(inst.id)) {
            toast(tr("Сначала закройте игру", "Close the game first"), "error");
            break;
          }
          if (confirm(tr(`Удалить сборку «${inst.name}» вместе с мирами?`, `Delete "${inst.name}" with all worlds?`))) {
            await api.deleteInstance(inst.id);
            await refreshInstances();
          }
          break;
      }
    } catch (e) {
      toast(errText(e), "error");
    }
  };

  const importPack = async () => {
    const path = await open({ multiple: false, filters: [{ name: "Modrinth pack", extensions: ["mrpack"] }] });
    if (typeof path !== "string") return;
    const id = newTaskId("import");
    setImportTask(id);
    try {
      const inst = await api.importMrpack(path, id);
      await refreshInstances();
      toast(tr(`Импортировано: ${inst.name}`, `Imported: ${inst.name}`), "ok");
    } catch (e) {
      toast(errText(e), "error");
    } finally {
      setImportTask(null);
    }
  };
  const ip = importTask ? progress[importTask] : undefined;

  return (
    <div className="library screen-scroll">
      <div className="screen-head">
        <div className="tabs">
          <button className="tab on">{tr("Библиотека", "Library")}</button>
          <button className="tab" onClick={() => go("catalog")}>{tr("Каталог", "Catalog")}</button>
        </div>
        <input className="search" placeholder={tr("Поиск сборок…", "Search instances…")} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="px-btn ghost small" onClick={importPack}>{tr("Импорт .mrpack", "Import .mrpack")}</button>
      </div>
      {importTask && <ProgressBar value={ip?.current ?? 0} total={ip?.total ?? 0} text={ip?.text ?? tr("Импорт...", "Importing...")} />}

      <h2 className="pixel-title">{tr("Мои сборки", "My instances")}</h2>
      <div className="inst-grid">
        {list.map((i) => (
          <div
            key={i.id}
            className="inst-card panel"
            onClick={() => updateSettings({ selectedInstance: i.id })}
            onDoubleClick={() => act("play", i)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ inst: i, x: e.clientX, y: e.clientY });
            }}
          >
            <div className="inst-icon"><PixelIcon name={i.icon} size={56} /></div>
            <div className="inst-name">{i.name}</div>
            <div className="muted small">{LOADER_NAMES[i.loader]} · {i.mcVersion}</div>
            {running.includes(i.id) && <span className="tag live">▶ {tr("в игре", "running")}</span>}
            <button
              className="icon-btn more"
              onClick={(e) => {
                e.stopPropagation();
                setMenu({ inst: i, x: e.clientX, y: e.clientY });
              }}
            >
              ⋮
            </button>
          </div>
        ))}
        <button className="inst-card panel add" onClick={() => setModal({ type: "editor" })}>
          <span className="plus">+</span>
          <span>{tr("Новая сборка", "New instance")}</span>
        </button>
      </div>

      {recommended && recommended.hits.length > 0 && (
        <>
          <h2 className="pixel-title">{tr("Рекомендуем", "Recommended")}</h2>
          <div className="project-grid">
            {recommended.hits.map((h) => (
              <ProjectCard key={h.project_id} hit={h} />
            ))}
          </div>
        </>
      )}

      {menu && (
        <div className="context-menu panel" style={{ left: Math.min(menu.x, window.innerWidth - 200), top: Math.min(menu.y, window.innerHeight - 300) }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => act("play", menu.inst)}>▶ {tr("Играть", "Play")}</button>
          <button onClick={() => act("folder", menu.inst)}>{tr("Открыть папку", "Open folder")}</button>
          <button onClick={() => act("mods", menu.inst)}>{tr("Моды", "Mods")}</button>
          <button onClick={() => act("settings", menu.inst)}>{tr("Настройки", "Settings")}</button>
          <button onClick={() => act("duplicate", menu.inst)}>{tr("Дублировать", "Duplicate")}</button>
          <button onClick={() => act("export", menu.inst)}>{tr("Экспорт (.mrpack)", "Export (.mrpack)")}</button>
          <button className="danger" onClick={() => act("delete", menu.inst)}>{tr("Удалить", "Delete")}</button>
        </div>
      )}
    </div>
  );
}
