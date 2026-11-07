// Управление контентом сборки: моды, ресурспаки, шейдеры, датапаки; обновления по хешам.
import { useEffect, useState } from "react";
import { api, errText, type ContentFile, type UpdateInfo } from "../lib/api";
import { useApp, useTr } from "../store";
import { Modal } from "./Modal";
import { PixelIcon } from "./PixelIcon";

const KINDS = [
  { key: "mods", ru: "Моды", en: "Mods" },
  { key: "resourcepacks", ru: "Ресурспаки", en: "Resource packs" },
  { key: "shaderpacks", ru: "Шейдеры", en: "Shaders" },
  { key: "datapacks", ru: "Датапаки", en: "Datapacks" },
];

export function ContentManager({ instanceId }: { instanceId: string }) {
  const tr = useTr();
  const { setModal, toast, instances, go } = useApp();
  const inst = instances.find((i) => i.id === instanceId);
  const [kind, setKind] = useState("mods");
  const [files, setFiles] = useState<ContentFile[]>([]);
  const [updates, setUpdates] = useState<UpdateInfo[] | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => api.listContent(instanceId, kind).then(setFiles).catch((e) => toast(errText(e), "error"));
  useEffect(() => {
    reload();
  }, [kind, instanceId]);

  const check = async () => {
    setBusy(true);
    try {
      setUpdates(await api.checkUpdates(instanceId));
    } catch (e) {
      toast(errText(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`${tr("Контент", "Content")}: ${inst?.name ?? ""}`} onClose={() => setModal(null)} wide>
      <div className="row between">
        <div className="seg small">
          {KINDS.map((k) => (
            <button key={k.key} className={kind === k.key ? "on" : ""} onClick={() => setKind(k.key)}>
              {tr(k.ru, k.en)}
            </button>
          ))}
        </div>
        <div className="row">
          <button className="px-btn ghost small" onClick={() => api.openInstanceFolder(instanceId, kind)}>{tr("Папка", "Folder")}</button>
          <button className="px-btn ghost small" onClick={() => { setModal(null); go("catalog"); }}>{tr("Найти ещё", "Browse")}</button>
          {kind === "mods" && (
            <button className="px-btn small" onClick={check} disabled={busy}>{busy ? "..." : tr("Обновления", "Updates")}</button>
          )}
        </div>
      </div>
      {kind === "datapacks" && (
        <p className="muted small">{tr("Датапаки работают внутри мира: скопируйте их в saves/<мир>/datapacks или используйте мод Global Packs.", "Datapacks belong to a world: copy them to saves/<world>/datapacks.")}</p>
      )}
      {updates && kind === "mods" && (
        <div className="updates">
          {updates.length === 0 ? (
            <div className="muted">{tr("Все моды актуальны", "All mods are up to date")}</div>
          ) : (
            updates.map((u) => (
              <div key={u.file} className="list-row">
                <span>{u.title}</span>
                <span className="muted small">→ {u.newVersionName}</span>
                <button
                  className="px-btn small"
                  onClick={async () => {
                    try {
                      await api.applyUpdate(instanceId, u.file, u.newVersionId);
                      setUpdates((list) => list?.filter((x) => x.file !== u.file) ?? null);
                      reload();
                    } catch (e) {
                      toast(errText(e), "error");
                    }
                  }}
                >
                  {tr("Обновить", "Update")}
                </button>
              </div>
            ))
          )}
        </div>
      )}
      <div className="content-list">
        {files.length === 0 && <div className="empty muted">{tr("Пусто", "Empty")}</div>}
        {files.map((f) => (
          <div key={f.file} className={`list-row ${f.enabled ? "" : "disabled"}`}>
            {f.iconUrl ? <img src={f.iconUrl} width={28} height={28} alt="" /> : <PixelIcon name="chest" size={28} />}
            <div className="grow">
              <div>{f.title ?? f.file.replace(/\.disabled$/, "")}</div>
              <div className="muted small">{f.file} · {(f.size / 1024 / 1024).toFixed(2)} МБ</div>
            </div>
            <label className="switch" title={tr("Включить/выключить", "Toggle")}>
              <input type="checkbox" checked={f.enabled} onChange={() => api.toggleContent(instanceId, kind, f.file).then(reload).catch((e) => toast(errText(e), "error"))} />
              <span />
            </label>
            <button className="icon-btn danger" title={tr("Удалить", "Delete")} onClick={() => api.deleteContent(instanceId, kind, f.file).then(reload).catch((e) => toast(errText(e), "error"))}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
