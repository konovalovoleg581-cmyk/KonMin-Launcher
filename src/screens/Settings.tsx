// Настройки лаунчера.
import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/api";
import { useApp, useTr } from "../store";

export function SettingsScreen() {
  const tr = useTr();
  const { settings, updateSettings, sys, go, prevScreen } = useApp();
  const [ram, setRam] = useState(settings?.ramMb ?? 4096);
  if (!settings) return null;

  return (
    <div className="settings screen-scroll">
      <button className="px-btn ghost small" onClick={() => go(prevScreen === "settings" ? "lobby" : prevScreen)}>← {tr("Назад", "Back")}</button>
      <h1 className="pixel-title">{tr("Настройки", "Settings")}</h1>

      <section className="panel pad form">
        <h3 className="pixel-title small">{tr("Память", "Memory")}</h3>
        <input
          type="range"
          min={1024}
          max={32768}
          step={512}
          value={ram}
          onChange={(e) => setRam(Number(e.target.value))}
          onMouseUp={() => updateSettings({ ramMb: ram })}
          onKeyUp={() => updateSettings({ ramMb: ram })}
        />
        <div>{(ram / 1024).toFixed(1)} ГБ {ram > 12288 && <span className="warn small">{tr("— больше 12 ГБ обычно не нужно", "— more than 12 GB is rarely needed")}</span>}</div>
      </section>

      <section className="panel pad form">
        <h3 className="pixel-title small">Java</h3>
        <div className="row">
          <input
            value={settings.javaPath ?? ""}
            placeholder={tr("Автоматически (загружается нужная версия от Mojang)", "Automatic (downloaded from Mojang)")}
            onChange={(e) => updateSettings({ javaPath: e.target.value || null })}
          />
          <button
            className="px-btn ghost small"
            onClick={async () => {
              const p = await open({ multiple: false, directory: false });
              if (typeof p === "string") updateSettings({ javaPath: p });
            }}
          >
            {tr("Обзор", "Browse")}
          </button>
          {settings.javaPath && <button className="px-btn ghost small" onClick={() => updateSettings({ javaPath: null })}>{tr("Сброс", "Reset")}</button>}
        </div>
      </section>

      <section className="panel pad form">
        <h3 className="pixel-title small">{tr("Папка данных", "Data folder")}</h3>
        <div className="row">
          <input readOnly value={settings.dataDir ?? sys?.dataDir ?? ""} />
          <button
            className="px-btn ghost small"
            onClick={async () => {
              const p = await open({ directory: true, multiple: false });
              if (typeof p === "string") updateSettings({ dataDir: p });
            }}
          >
            {tr("Изменить", "Change")}
          </button>
          <button className="px-btn ghost small" onClick={() => api.openDataFolder()}>{tr("Открыть", "Open")}</button>
        </div>
        <p className="muted small">{tr("Существующие сборки не переносятся автоматически. Конфиг и аккаунты всегда хранятся в %APPDATA%/KonMin.", "Existing instances are not moved automatically.")}</p>
      </section>

      <section className="panel pad form">
        <h3 className="pixel-title small">{tr("Язык", "Language")}</h3>
        <div className="seg">
          <button className={settings.language === "ru" ? "on" : ""} onClick={() => updateSettings({ language: "ru" })}>Русский</button>
          <button className={settings.language === "en" ? "on" : ""} onClick={() => updateSettings({ language: "en" })}>English</button>
        </div>
      </section>

      <section className="panel pad form">
        <h3 className="pixel-title small">{tr("После запуска игры", "After the game starts")}</h3>
        <div className="seg">
          <button className={settings.afterLaunch === "minimize" ? "on" : ""} onClick={() => updateSettings({ afterLaunch: "minimize" })}>{tr("Свернуть", "Minimize")}</button>
          <button className={settings.afterLaunch === "close" ? "on" : ""} onClick={() => updateSettings({ afterLaunch: "close" })}>{tr("Закрыть", "Close")}</button>
          <button className={settings.afterLaunch === "keep" ? "on" : ""} onClick={() => updateSettings({ afterLaunch: "keep" })}>{tr("Оставить", "Keep open")}</button>
        </div>
        <p className="muted small">{tr("«Закрыть» прячет лаунчер и завершает его после выхода из игры (при краше окно вернётся).", "\"Close\" hides the launcher and exits after the game closes.")}</p>
      </section>

      <section className="panel pad">
        <p className="muted small">
          KonMin Launcher {sys?.version} · {sys?.os}/{sys?.arch}
          <br />
          {tr("Не связан с Mojang Studios и Microsoft. Minecraft — товарный знак Mojang Synergies AB.", "Not affiliated with Mojang Studios or Microsoft.")}
        </p>
      </section>
    </div>
  );
}
