// Вход: Ely.by (логин/пароль + 2FA) или Гость (оффлайн-ник).
import { useState } from "react";
import { api, errText } from "../lib/api";
import { useApp, useTr } from "../store";
import { Modal } from "./Modal";

export function LoginModal() {
  const tr = useTr();
  const setModal = useApp((s) => s.setModal);
  const refresh = useApp((s) => s.refreshAccounts);
  const toast = useApp((s) => s.toast);
  const [tab, setTab] = useState<"ely" | "guest">("ely");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [need2fa, setNeed2fa] = useState(false);
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitEly = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.elyLogin(login, password, need2fa ? totp : null);
      if (r.status === "need2fa") {
        setNeed2fa(true);
      } else {
        setPassword("");
        await refresh();
        toast(tr(`Вход выполнен: ${r.account?.name}`, `Signed in: ${r.account?.name}`), "ok");
        setModal(null);
      }
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const submitGuest = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.addGuest(nick);
      await refresh();
      setModal(null);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={tr("Вход", "Sign in")} onClose={() => setModal(null)}>
      <div className="seg">
        <button className={tab === "ely" ? "on" : ""} onClick={() => setTab("ely")}>Ely.by</button>
        <button className={tab === "guest" ? "on" : ""} onClick={() => setTab("guest")}>{tr("Гость", "Guest")}</button>
      </div>
      {tab === "ely" ? (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            submitEly();
          }}
        >
          <label>
            {tr("Ник или e-mail", "Nickname or e-mail")}
            <input value={login} onChange={(e) => setLogin(e.target.value)} autoFocus autoComplete="username" />
          </label>
          <label>
            {tr("Пароль", "Password")}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {need2fa && (
            <label>
              {tr("Код двухфакторной аутентификации", "Two-factor code")}
              <input value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="123456" autoFocus />
            </label>
          )}
          {error && <div className="error-box">{error}</div>}
          <button className="px-btn" disabled={busy || !login || !password || (need2fa && totp.length < 6)}>
            {busy ? "..." : tr("Войти", "Sign in")}
          </button>
          <p className="muted small">
            {tr("Нет аккаунта? ", "No account? ")}
            <a href="#" onClick={(e) => { e.preventDefault(); api.openUrl("https://account.ely.by/register"); }}>
              {tr("Регистрация на Ely.by", "Register on Ely.by")}
            </a>
            . {tr("Пароль не сохраняется — хранится только токен в защищённом хранилище системы.", "The password is not stored — only a token in the system keychain.")}
          </p>
        </form>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            submitGuest();
          }}
        >
          <label>
            {tr("Ник для оффлайн-игры", "Offline nickname")}
            <input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={16} autoFocus />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button className="px-btn" disabled={busy || nick.length < 3}>{tr("Играть как гость", "Play as guest")}</button>
          <p className="muted small">{tr("Гостевой режим: одиночная игра и серверы без авторизации. Скины Ely.by недоступны.", "Guest mode: singleplayer and offline servers only. Ely.by skins are not available.")}</p>
        </form>
      )}
    </Modal>
  );
}
