// «Играть с друзьями»: личный список серверов (хранится локально).
import { useState } from "react";
import { useApp, useTr } from "../store";
import { PixelIcon } from "../components/PixelIcon";

interface Server {
  name: string;
  address: string;
}

const KEY = "konmin.servers";
function loadServers(): Server[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function Servers() {
  const tr = useTr();
  const { go, toast } = useApp();
  const [servers, setServers] = useState<Server[]>(loadServers);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const save = (list: Server[]) => {
    setServers(list);
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      /* хранилище недоступно */
    }
  };

  return (
    <div className="servers screen-scroll">
      <button className="px-btn ghost small" onClick={() => go("lobby")}>← {tr("Назад", "Back")}</button>
      <h1 className="pixel-title">{tr("Играть с друзьями", "Play with friends")}</h1>
      <p className="muted">
        {tr(
          "Сохраните адреса серверов. В игре: «Сетевая игра» → «Прямое подключение» → вставьте адрес. Серверы с авторизацией Ely.by пускают только при входе через Ely.by.",
          "Save server addresses. In game: Multiplayer → Direct Connection → paste the address.",
        )}
      </p>
      <form
        className="row panel pad"
        onSubmit={(e) => {
          e.preventDefault();
          if (!address.trim()) return;
          save([...servers, { name: name.trim() || address.trim(), address: address.trim() }]);
          setName("");
          setAddress("");
        }}
      >
        <input placeholder={tr("Название", "Name")} value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="play.example.com:25565" value={address} onChange={(e) => setAddress(e.target.value)} />
        <button className="px-btn small">{tr("Добавить", "Add")}</button>
      </form>
      <div className="panel">
        {servers.length === 0 && <div className="pad muted">{tr("Список пуст", "No servers yet")}</div>}
        {servers.map((s, i) => (
          <div key={i} className="list-row">
            <PixelIcon name="globe" size={28} />
            <div className="grow">
              <div>{s.name}</div>
              <div className="muted small">{s.address}</div>
            </div>
            <button
              className="px-btn ghost small"
              onClick={() => {
                navigator.clipboard.writeText(s.address);
                toast(tr("Адрес скопирован", "Address copied"), "ok");
              }}
            >
              {tr("Копировать", "Copy")}
            </button>
            <button className="icon-btn danger" onClick={() => save(servers.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
