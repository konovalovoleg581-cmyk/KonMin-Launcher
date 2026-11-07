// Собственная рамка окна: перетаскивание, свернуть/развернуть/закрыть.
import { getCurrentWindow } from "@tauri-apps/api/window";

export function TitleBar() {
  const win = getCurrentWindow();
  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-title" data-tauri-drag-region>
        <span className="logo-k">K</span>
        KonMin Launcher
      </div>
      <div className="titlebar-buttons">
        <button title="Свернуть" onClick={() => win.minimize()}>
          <svg width="10" height="10" viewBox="0 0 10 10"><rect y="8" width="10" height="2" fill="currentColor" /></svg>
        </button>
        <button title="Развернуть" onClick={() => win.toggleMaximize()}>
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0h10v10H0zM2 3v5h6V3z" fill="currentColor" fillRule="evenodd" /></svg>
        </button>
        <button title="Закрыть" className="close" onClick={() => win.close()}>
          <svg width="10" height="10" viewBox="0 0 10 10" shapeRendering="crispEdges">
            <path d="M0 0h2v2H0zM2 2h2v2H2zM4 4h2v2H4zM6 6h2v2H6zM8 8h2v2H8zM8 0h2v2H8zM6 2h2v2H6zM2 6h2v2H2zM0 8h2v2H0z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}
