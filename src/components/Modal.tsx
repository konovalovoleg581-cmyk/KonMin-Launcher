import type { ReactNode } from "react";

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal panel ${wide ? "wide" : ""}`}>
        <div className="modal-head">
          <h2 className="pixel-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function ProgressBar({ value, total, text }: { value: number; total: number; text?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="progress">
      <div className="progress-fill" style={{ width: `${total > 0 ? pct : 100}%` }} data-indeterminate={total <= 1 && value === 0} />
      {text && <span className="progress-text">{text}{total > 1 ? ` — ${value}/${total}` : ""}</span>}
    </div>
  );
}
