// Экран 2 — Гардероб.
import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api, errText, type LocalSkin } from "../lib/api";
import { useApp, useTr } from "../store";
import { SkinViewer } from "../components/SkinViewer";

type Tab = "skins" | "capes" | "head" | "body" | "back" | "pets" | "emotes";

export function Wardrobe() {
  const tr = useTr();
  const { textures, refreshTextures, accounts, activeId, toast, setModal } = useApp();
  const account = accounts.find((a) => a.id === activeId);
  const isEly = account?.kind === "ely";
  const [tab, setTab] = useState<Tab>("skins");
  const [local, setLocal] = useState<LocalSkin[]>([]);
  const [selected, setSelected] = useState<LocalSkin | null>(null);
  const [slim, setSlim] = useState(textures.slim);
  const [walk, setWalk] = useState(true);

  useEffect(() => {
    api.localSkins().then(setLocal).catch(() => {});
  }, []);
  useEffect(() => setSlim(selected ? selected.slim : textures.slim), [selected, textures.slim]);

  const previewSkin = selected?.dataUrl ?? textures.skin;

  const importPng = async () => {
    const path = await open({ multiple: false, filters: [{ name: "PNG", extensions: ["png"] }] });
    if (typeof path !== "string") return;
    try {
      const s = await api.importSkin(path, null, slim);
      setLocal((l) => [...l, s]);
      setSelected(s);
      toast(tr("Скин добавлен в «Мои»", "Skin added to My skins"), "ok");
    } catch (e) {
      toast(errText(e), "error");
    }
  };

  const upload = async () => {
    if (!isEly) {
      toast(tr("Чтобы скин был виден в игре, войдите через Ely.by", "Sign in with Ely.by to use skins in game"), "info");
      setModal({ type: "login" });
      return;
    }
    try {
      const saved = await api.prepareElyUpload(selected?.id ?? null);
      toast(
        saved
          ? tr("Файл скина сохранён в «Загрузки». Загрузите его на открывшейся странице Ely.by и нажмите «Обновить».", "Skin saved to Downloads. Upload it on the Ely.by page, then press Refresh.")
          : tr("Открыта страница Ely.by. После смены скина нажмите «Обновить».", "Ely.by opened. Press Refresh after changing your skin."),
        "info",
      );
    } catch (e) {
      toast(errText(e), "error");
    }
  };

  const tabs: { key: Tab; ru: string; en: string; soon?: boolean }[] = [
    { key: "skins", ru: "Скины", en: "Skins" },
    { key: "capes", ru: "Плащи", en: "Capes" },
    { key: "head", ru: "Голова", en: "Head", soon: true },
    { key: "body", ru: "Тело", en: "Body", soon: true },
    { key: "back", ru: "Спина", en: "Back", soon: true },
    { key: "pets", ru: "Питомцы", en: "Pets", soon: true },
    { key: "emotes", ru: "Эмоции", en: "Emotes", soon: true },
  ];

  return (
    <div className="wardrobe">
      <div className="wardrobe-preview panel">
        <SkinViewer skin={previewSkin} cape={textures.cape} slim={slim} walking={walk} zoom={0.9} />
        <div className="preview-controls">
          <div className="seg small">
            <button className={!slim ? "on" : ""} onClick={() => setSlim(false)}>Steve (classic)</button>
            <button className={slim ? "on" : ""} onClick={() => setSlim(true)}>Alex (slim)</button>
          </div>
          <button className="px-btn ghost small" onClick={() => setWalk(!walk)}>{walk ? tr("Стоять", "Idle") : tr("Идти", "Walk")}</button>
        </div>
      </div>

      <div className="wardrobe-side">
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t.key} className={`tab ${tab === t.key ? "on" : ""}`} onClick={() => setTab(t.key)}>
              {tr(t.ru, t.en)}
              {t.soon && <span className="soon">{tr("скоро", "soon")}</span>}
            </button>
          ))}
        </div>

        {tab === "skins" && (
          <div className="panel pad">
            <div className="row between">
              <h3 className="pixel-title small">{tr("Текущий", "Current")}</h3>
              <div className="row">
                <button className="px-btn ghost small" onClick={importPng}>{tr("Импорт", "Import")}</button>
                <button className="px-btn small" onClick={upload}>{tr("Загрузить скин", "Upload skin")}</button>
                <button className="px-btn ghost small" onClick={() => refreshTextures().then(() => setSelected(null))}>⟳ {tr("Обновить", "Refresh")}</button>
              </div>
            </div>
            <p className="muted small">
              {isEly
                ? tr(`Скин аккаунта Ely.by «${account?.name}». В игре он виден благодаря authlib-injector.`, `Ely.by skin of "${account?.name}". Visible in game via authlib-injector.`)
                : tr("Гость: скины видны только в лаунчере. Войдите через Ely.by, чтобы их видели все.", "Guest: skins are visible only in the launcher.")}
            </p>
            <div className="skin-grid">
              <button className={`skin-tile ${selected === null ? "on" : ""}`} onClick={() => setSelected(null)}>
                {textures.skin ? <img src={textures.skin} className="pixel-img" alt="" /> : <span className="muted small">{tr("Стандартный", "Default")}</span>}
                <span className="small">{isEly ? "Ely.by" : tr("Стандартный", "Default")}</span>
              </button>
            </div>
            <h3 className="pixel-title small">{tr("Мои", "Mine")}</h3>
            <div className="skin-grid">
              {local.map((s) => (
                <div key={s.id} className={`skin-tile ${selected?.id === s.id ? "on" : ""}`} onClick={() => setSelected(s)}>
                  <img src={s.dataUrl} className="pixel-img" alt="" />
                  <span className="small">{s.name}</span>
                  <button
                    className="tile-del"
                    title={tr("Удалить", "Delete")}
                    onClick={async (e) => {
                      e.stopPropagation();
                      await api.deleteSkin(s.id);
                      setLocal((l) => l.filter((x) => x.id !== s.id));
                      if (selected?.id === s.id) setSelected(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button className="skin-tile add" onClick={importPng}>+ PNG</button>
            </div>
          </div>
        )}

        {tab === "capes" && (
          <div className="panel pad">
            <h3 className="pixel-title small">{tr("Плащ", "Cape")}</h3>
            {textures.cape ? (
              <div className="skin-grid">
                <div className="skin-tile on">
                  <img src={textures.cape} className="pixel-img" alt="" />
                  <span className="small">Ely.by</span>
                </div>
              </div>
            ) : (
              <p className="muted">{tr("У аккаунта нет плаща.", "No cape on this account.")}</p>
            )}
            <p className="muted small">{tr("Плащи Ely.by выдаются и меняются на сайте ely.by.", "Ely.by capes are managed on ely.by.")}</p>
            <button className="px-btn ghost small" onClick={() => api.openUrl("https://ely.by/")}>ely.by</button>
          </div>
        )}

        {tabs.find((t) => t.key === tab)?.soon && (
          <div className="panel pad center">
            <p className="pixel-title small">{tr("Скоро", "Coming soon")}</p>
            <p className="muted">{tr("Этот раздел гардероба появится в следующих версиях.", "This wardrobe section is coming in a future version.")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
