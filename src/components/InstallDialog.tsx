// Установка проекта Modrinth: мод/ресурспак/шейдер — в выбранную сборку;
// модпак — как новая сборка.
import { useEffect, useState } from "react";
import { api, errText, LOADER_NAMES, newTaskId, type MrVersion } from "../lib/api";
import { useApp, useTr } from "../store";
import { Modal, ProgressBar } from "./Modal";
import { PixelIcon } from "./PixelIcon";

export function InstallDialog({ projectId, projectType, title, versionId }: { projectId: string; projectType: string; title: string; versionId?: string }) {
  const tr = useTr();
  const { setModal, instances, toast, refreshInstances, progress, updateSettings } = useApp();
  const [target, setTarget] = useState(instances[0]?.id ?? "");
  const [task, setTask] = useState<string | null>(null);
  const [versions, setVersions] = useState<MrVersion[]>([]);
  const [chosen, setChosen] = useState(versionId ?? "");
  const [done, setDone] = useState<string | null>(null);
  const isPack = projectType === "modpack";
  const p = task ? progress[task] : undefined;

  useEffect(() => {
    if (!isPack) return;
    api
      .modrinth<MrVersion[]>(`/project/${projectId}/version`)
      .then((v) => {
        setVersions(v);
        if (!versionId && v[0]) setChosen(v[0].id);
      })
      .catch((e) => toast(errText(e), "error"));
  }, [projectId]);

  const run = async () => {
    const id = newTaskId("install");
    setTask(id);
    try {
      if (isPack) {
        const inst = await api.installModpackVersion(chosen, id);
        await refreshInstances();
        await updateSettings({ selectedInstance: inst.id });
        setDone(tr(`Сборка «${inst.name}» создана`, `Instance "${inst.name}" created`));
      } else {
        const r = await api.installProject(target, projectId, versionId ?? null, id);
        setDone(tr("Установлено: ", "Installed: ") + r.installed.join(", "));
      }
    } catch (e) {
      toast(errText(e), "error");
      setTask(null);
    }
  };

  return (
    <Modal title={`${tr("Установка", "Install")}: ${title}`} onClose={() => setModal(null)}>
      {done ? (
        <>
          <div className="ok-box">{done}</div>
          <div className="modal-actions">
            <button className="px-btn" onClick={() => setModal(null)}>OK</button>
          </div>
        </>
      ) : task ? (
        <ProgressBar value={p?.current ?? 0} total={p?.total ?? 0} text={p?.text ?? tr("Подготовка...", "Preparing...")} />
      ) : isPack ? (
        <div className="form">
          <p className="muted">{tr("Модпак будет установлен как новая сборка: файлы скачаются с проверкой хешей, затем применятся overrides.", "The modpack will be installed as a new instance.")}</p>
          <label>
            {tr("Версия модпака", "Modpack version")}
            <select value={chosen} onChange={(e) => setChosen(e.target.value)}>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version_number} — {v.loaders.join(", ")} · {v.game_versions.join(", ")}
                </option>
              ))}
            </select>
          </label>
          <div className="modal-actions">
            <button className="px-btn" onClick={run} disabled={!chosen}>{tr("Установить", "Install")}</button>
          </div>
        </div>
      ) : instances.length === 0 ? (
        <div className="form">
          <p>{tr("Сначала создайте сборку.", "Create an instance first.")}</p>
          <button className="px-btn" onClick={() => setModal({ type: "editor" })}>{tr("+ Новая сборка", "+ New instance")}</button>
        </div>
      ) : (
        <div className="form">
          <span>{tr("Куда установить:", "Install into:")}</span>
          <div className="pick-list">
            {instances.map((i) => (
              <button key={i.id} className={`pick ${target === i.id ? "on" : ""}`} onClick={() => setTarget(i.id)}>
                <PixelIcon name={i.icon} size={28} />
                <div>
                  <div>{i.name}</div>
                  <div className="muted small">{LOADER_NAMES[i.loader]} · {i.mcVersion}</div>
                </div>
              </button>
            ))}
          </div>
          <p className="muted small">{tr("Подходящая версия файла и обязательные зависимости подберутся автоматически.", "A compatible file and required dependencies are selected automatically.")}</p>
          <div className="modal-actions">
            <button className="px-btn" onClick={run} disabled={!target}>{tr("Установить", "Install")}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
