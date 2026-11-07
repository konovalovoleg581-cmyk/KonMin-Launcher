// Создание и настройка сборки.
import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api, errText, LOADER_NAMES, type Instance, type Loader, type LoaderVersion, type ManifestVersion } from "../lib/api";
import { useApp, useTr } from "../store";
import { Modal } from "./Modal";
import { ICON_KEYS, PixelIcon } from "./PixelIcon";

let manifestCache: ManifestVersion[] | null = null;
export async function loadManifest(): Promise<ManifestVersion[]> {
  if (manifestCache) return manifestCache;
  const list = (await api.versionManifest()).versions;
  manifestCache = list;
  return list;
}

export function InstanceEditor({ instance }: { instance?: Instance }) {
  const tr = useTr();
  const { setModal, refreshInstances, toast, settings, updateSettings } = useApp();
  const [name, setName] = useState(instance?.name ?? "");
  const [icon, setIcon] = useState(instance?.icon ?? "grass");
  const [kind, setKind] = useState<"release" | "snapshot" | "old">("release");
  const [versions, setVersions] = useState<ManifestVersion[]>([]);
  const [mc, setMc] = useState(instance?.mcVersion ?? "");
  const [loader, setLoader] = useState<Loader>(instance?.loader ?? "vanilla");
  const [loaderVersions, setLoaderVersions] = useState<LoaderVersion[]>([]);
  const [lv, setLv] = useState(instance?.loaderVersion ?? "");
  const [lvLoading, setLvLoading] = useState(false);
  const [customRam, setCustomRam] = useState(instance?.ramMb != null);
  const [ram, setRam] = useState(instance?.ramMb ?? settings?.ramMb ?? 4096);
  const [jvmArgs, setJvmArgs] = useState(instance?.jvmArgs ?? "");
  const [javaPath, setJavaPath] = useState(instance?.javaPath ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadManifest()
      .then((v) => {
        setVersions(v);
        if (!mc) setMc(v.find((x) => x.type === "release")?.id ?? v[0]?.id ?? "");
      })
      .catch((e) => toast(errText(e), "error"));
  }, []);

  const shown = useMemo(
    () =>
      versions.filter((v) =>
        kind === "release" ? v.type === "release" : kind === "snapshot" ? v.type === "snapshot" : v.type.startsWith("old"),
      ),
    [versions, kind],
  );

  useEffect(() => {
    if (loader === "vanilla" || !mc) {
      setLoaderVersions([]);
      return;
    }
    setLvLoading(true);
    api
      .loaderVersions(loader, mc)
      .then((l) => {
        setLoaderVersions(l);
        if (lv && !l.some((x) => x.version === lv)) setLv("");
      })
      .catch(() => setLoaderVersions([]))
      .finally(() => setLvLoading(false));
  }, [loader, mc]);

  const save = async () => {
    setBusy(true);
    try {
      const base = {
        name,
        icon,
        mcVersion: mc,
        loader,
        loaderVersion: loader === "vanilla" ? null : lv || null,
        ramMb: customRam ? ram : null,
        jvmArgs,
        javaPath: javaPath || null,
      };
      if (instance) {
        await api.updateInstance({ ...instance, ...base });
      } else {
        const created = await api.createInstance(base);
        await updateSettings({ selectedInstance: created.id });
      }
      await refreshInstances();
      setModal(null);
    } catch (e) {
      toast(errText(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={instance ? tr("Настройки сборки", "Instance settings") : tr("Новая сборка", "New instance")} onClose={() => setModal(null)} wide>
      <div className="form two-col">
        <label>
          {tr("Название", "Name")}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={mc || "Моя сборка"} />
        </label>
        <div className="field">
          <span>{tr("Иконка", "Icon")}</span>
          <div className="icon-picker">
            {ICON_KEYS.map((k) => (
              <button key={k} className={icon === k ? "on" : ""} onClick={() => setIcon(k)} type="button">
                <PixelIcon name={k} size={24} />
              </button>
            ))}
            {icon.startsWith("http") && (
              <button className="on" type="button"><PixelIcon name={icon} size={24} /></button>
            )}
          </div>
        </div>

        <div className="field">
          <span>{tr("Версия Minecraft", "Minecraft version")}</span>
          <div className="seg small">
            <button type="button" className={kind === "release" ? "on" : ""} onClick={() => setKind("release")}>{tr("Релизы", "Releases")}</button>
            <button type="button" className={kind === "snapshot" ? "on" : ""} onClick={() => setKind("snapshot")}>{tr("Снапшоты", "Snapshots")}</button>
            <button type="button" className={kind === "old" ? "on" : ""} onClick={() => setKind("old")}>{tr("Старые", "Old")}</button>
          </div>
          <select value={mc} onChange={(e) => setMc(e.target.value)}>
            {!shown.some((v) => v.id === mc) && mc && <option value={mc}>{mc}</option>}
            {shown.map((v) => (
              <option key={v.id} value={v.id}>{v.id}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <span>{tr("Загрузчик", "Loader")}</span>
          <div className="seg small">
            {(Object.keys(LOADER_NAMES) as Loader[]).map((l) => (
              <button type="button" key={l} className={loader === l ? "on" : ""} onClick={() => setLoader(l)}>
                {LOADER_NAMES[l]}
              </button>
            ))}
          </div>
          {loader !== "vanilla" && (
            <select value={lv} onChange={(e) => setLv(e.target.value)} disabled={lvLoading}>
              <option value="">{lvLoading ? tr("Загрузка...", "Loading...") : tr("Последняя стабильная", "Latest stable")}</option>
              {loaderVersions.map((v) => (
                <option key={v.version} value={v.version}>
                  {v.version}{v.stable ? "" : " (beta)"}
                </option>
              ))}
            </select>
          )}
          {loader !== "vanilla" && !lvLoading && loaderVersions.length === 0 && (
            <span className="warn small">{tr(`Нет версий ${LOADER_NAMES[loader]} для ${mc}`, `No ${LOADER_NAMES[loader]} builds for ${mc}`)}</span>
          )}
        </div>

        <div className="field">
          <label className="check">
            <input type="checkbox" checked={customRam} onChange={(e) => setCustomRam(e.target.checked)} />
            {tr("Своя память для сборки", "Custom memory")}
          </label>
          <input type="range" min={1024} max={32768} step={512} value={ram} disabled={!customRam} onChange={(e) => setRam(Number(e.target.value))} />
          <span className="muted small">{customRam ? `${(ram / 1024).toFixed(1)} ГБ` : tr(`По умолчанию (${((settings?.ramMb ?? 4096) / 1024).toFixed(1)} ГБ)`, "Default")}</span>
        </div>

        <label>
          {tr("Аргументы JVM", "JVM arguments")}
          <input value={jvmArgs} onChange={(e) => setJvmArgs(e.target.value)} placeholder="-XX:+UseG1GC" />
        </label>
        <label>
          {tr("Своя Java (необязательно)", "Custom Java (optional)")}
          <div className="row">
            <input value={javaPath} onChange={(e) => setJavaPath(e.target.value)} placeholder={tr("Автоматически", "Automatic")} />
            <button
              type="button"
              className="px-btn ghost small"
              onClick={async () => {
                const p = await open({ multiple: false, directory: false });
                if (typeof p === "string") setJavaPath(p);
              }}
            >
              …
            </button>
          </div>
        </label>
      </div>
      <div className="modal-actions">
        <button className="px-btn ghost" onClick={() => setModal(null)}>{tr("Отмена", "Cancel")}</button>
        <button className="px-btn" onClick={save} disabled={busy || !mc}>
          {instance ? tr("Сохранить", "Save") : tr("Создать", "Create")}
        </button>
      </div>
    </Modal>
  );
}
