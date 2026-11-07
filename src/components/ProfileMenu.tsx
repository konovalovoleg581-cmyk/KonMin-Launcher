// Карточка профиля в шапке с выпадающим меню аккаунтов.
import { useEffect, useRef, useState } from "react";
import { api, errText } from "../lib/api";
import { useApp, useTr } from "../store";
import { PixelIcon } from "./PixelIcon";

export function ProfileMenu() {
  const tr = useTr();
  const { accounts, activeId, refreshAccounts, setModal, toast } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = accounts.find((a) => a.id === activeId);

  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!active) {
    return (
      <button className="px-btn small" onClick={() => setModal({ type: "login" })}>
        {tr("Войти", "Sign in")}
      </button>
    );
  }

  return (
    <div className="profile" ref={ref}>
      <button className="profile-card panel" onClick={() => setOpen(!open)}>
        <PixelIcon name="user" size={28} />
        <div className="profile-text">
          <div className="profile-name">{active.name}</div>
          <div className={`profile-status ${active.kind}`}>{active.kind === "ely" ? "Ely.by" : tr("Гость", "Guest")}</div>
        </div>
        <span className="caret">▾</span>
      </button>
      {open && (
        <div className="dropdown panel">
          {accounts.map((a) => (
            <button
              key={a.id}
              className={`dropdown-item ${a.id === activeId ? "on" : ""}`}
              onClick={async () => {
                await api.setActiveAccount(a.id);
                await refreshAccounts();
                setOpen(false);
              }}
            >
              {a.name} <span className="muted small">{a.kind === "ely" ? "Ely.by" : tr("гость", "guest")}</span>
            </button>
          ))}
          <div className="dropdown-sep" />
          <button className="dropdown-item" onClick={() => { setOpen(false); setModal({ type: "login" }); }}>
            + {tr("Добавить / сменить аккаунт", "Add / switch account")}
          </button>
          <button
            className="dropdown-item danger"
            onClick={async () => {
              try {
                await api.logout(active.id);
                await refreshAccounts();
              } catch (e) {
                toast(errText(e), "error");
              }
              setOpen(false);
            }}
          >
            {tr("Выйти", "Sign out")}
          </button>
        </div>
      )}
    </div>
  );
}
