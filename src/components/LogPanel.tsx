// Вкладка лога игры и диалог краша.
import { useEffect, useRef } from "react";
import { api, errText } from "../lib/api";
import { useApp, useTr } from "../store";
import { Modal } from "./Modal";

export function LogPanel() {
  const tr = useTr();
  const { logOpen, setLogOpen, logs, clearLog, instances, running, toast } = useApp();
  const end = useRef<HTMLDivElement>(null);
  const lines = logOpen ? logs[logOpen] ?? [] : [];
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [lines.length]);
  if (!logOpen) return null;
  const inst = instances.find((i) => i.id === logOpen);
  return (
    <div className="log-panel panel">
      <div className="row between">
        <h3 className="pixel-title small">{tr("Лог", "Log")}: {inst?.name}</h3>
        <div className="row">
          <button className="px-btn ghost small" onClick={() => navigator.clipboard.writeText(lines.join("\n"))}>{tr("Копировать", "Copy")}</button>
          <button className="px-btn ghost small" onClick={() => clearLog(logOpen)}>{tr("Очистить", "Clear")}</button>
          {running.includes(logOpen) && (
            <button className="px-btn danger small" onClick={() => api.kill(logOpen).catch((e) => toast(errText(e), "error"))}>
              {tr("Остановить игру", "Stop game")}
            </button>
          )}
          <button className="icon-btn" onClick={() => setLogOpen(null)}>✕</button>
        </div>
      </div>
      <div className="log-body">
        {lines.map((l, i) => (
          <div key={i} className={/ERROR|Exception|FATAL/.test(l) ? "log-err" : /WARN/.test(l) ? "log-warn" : ""}>{l}</div>
        ))}
        <div ref={end} />
      </div>
    </div>
  );
}

export function CrashDialog() {
  const tr = useTr();
  const { crash, setCrash, logs, setLogOpen, instances } = useApp();
  if (!crash) return null;
  const lines = logs[crash.instanceId] ?? [];
  const reason = lines.filter((l) => /Exception|Error|FATAL|Caused by/.test(l)).slice(-8);
  const inst = instances.find((i) => i.id === crash.instanceId);
  return (
    <Modal title={tr("Игра завершилась с ошибкой", "The game crashed")} onClose={() => setCrash(null)}>
      <p>
        {inst?.name} — {tr("код выхода", "exit code")} {crash.code ?? "?"}
      </p>
      {reason.length > 0 && <pre className="crash-reason">{reason.join("\n")}</pre>}
      <p className="muted small">{tr("Частые причины: несовместимые моды, не хватает памяти, неподходящая версия Java.", "Common causes: incompatible mods, not enough memory, wrong Java version.")}</p>
      <div className="modal-actions">
        <button className="px-btn ghost" onClick={() => { setLogOpen(crash.instanceId); setCrash(null); }}>{tr("Показать лог", "Show log")}</button>
        {crash.crashReport && (
          <button className="px-btn" onClick={() => api.openCrashReport(crash.crashReport!)}>{tr("Открыть crash-report", "Open crash report")}</button>
        )}
      </div>
    </Modal>
  );
}
