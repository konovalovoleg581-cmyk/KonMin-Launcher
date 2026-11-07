// Экран 4 — Каталог Modrinth.
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errText, formatNumber, type MrCategory, type SearchHit, type SearchResult } from "../lib/api";
import { loadManifest } from "../components/InstanceEditor";
import { useApp, useTr } from "../store";

const TYPES = [
  { key: "", ru: "Все", en: "All" },
  { key: "modpack", ru: "Сборки", en: "Modpacks" },
  { key: "mod", ru: "Моды", en: "Mods" },
  { key: "shader", ru: "Шейдеры", en: "Shaders" },
  { key: "resourcepack", ru: "Ресурспаки", en: "Resource packs" },
  { key: "datapack", ru: "Датапаки", en: "Datapacks" },
  { key: "plugin", ru: "Плагины", en: "Plugins" },
];
const SORTS = [
  { key: "relevance", ru: "По релевантности", en: "Relevance" },
  { key: "downloads", ru: "По загрузкам", en: "Downloads" },
  { key: "newest", ru: "Новые", en: "Newest" },
  { key: "updated", ru: "Обновлённые", en: "Updated" },
];
const LOADERS = ["fabric", "forge", "neoforge", "quilt"];
const PAGE = 20;

export function ProjectCard({ hit }: { hit: SearchHit }) {
  const tr = useTr();
  const { openProject, setModal } = useApp();
  const loaders = hit.categories.filter((c) => [...LOADERS, "iris", "optifine", "paper", "spigot", "datapack"].includes(c));
  const cover = hit.featured_gallery ?? hit.gallery?.[0] ?? null;
  return (
    <div className="project-card panel" onClick={() => openProject(hit.project_id)}>
      <div className="cover" style={cover ? { backgroundImage: `url("${cover}")` } : undefined}>
        {hit.icon_url && <img className="p-icon" src={hit.icon_url} alt="" loading="lazy" />}
      </div>
      <div className="p-body">
        <div className="p-title">{hit.title}</div>
        <div className="muted small">
          {tr("от", "by")} {hit.author} · ⬇ {formatNumber(hit.downloads)}
        </div>
        <div className="p-desc">{hit.description}</div>
        <div className="p-tags">
          {loaders.slice(0, 3).map((l) => (
            <span key={l} className="tag">{l}</span>
          ))}
          {hit.versions?.length > 0 && <span className="tag">{hit.versions[hit.versions.length - 1]}</span>}
        </div>
      </div>
      <button
        className="px-btn small install"
        onClick={(e) => {
          e.stopPropagation();
          setModal({ type: "install", projectId: hit.project_id, projectType: hit.project_type, title: hit.title });
        }}
      >
        {tr("Установить", "Install")}
      </button>
    </div>
  );
}

export function Catalog() {
  const tr = useTr();
  const { go, toast } = useApp();
  const [type, setType] = useState("");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState("relevance");
  const [gameVersion, setGameVersion] = useState("");
  const [loaders, setLoaders] = useState<string[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [env, setEnv] = useState<"" | "client" | "server">("");
  const [allCats, setAllCats] = useState<MrCategory[]>([]);
  const [gameVersions, setGameVersions] = useState<string[]>([]);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  useEffect(() => {
    api.modrinth<MrCategory[]>("/tag/category").then(setAllCats).catch(() => {});
    loadManifest()
      .then((v) => setGameVersions(v.filter((x) => x.type === "release").map((x) => x.id)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const facets = useCallback(() => {
    const f: string[][] = [];
    if (type) f.push([`project_type:${type}`]);
    if (gameVersion) f.push([`versions:${gameVersion}`]);
    if (loaders.length) f.push(loaders.map((l) => `categories:${l}`));
    for (const c of cats) f.push([`categories:${c}`]);
    if (env === "client") f.push(["client_side:required", "client_side:optional"]);
    if (env === "server") f.push(["server_side:required", "server_side:optional"]);
    return f;
  }, [type, gameVersion, loaders, cats, env]);

  const load = useCallback(
    async (offset: number) => {
      const id = ++reqId.current;
      setLoading(true);
      try {
        const q: [string, string][] = [
          ["limit", String(PAGE)],
          ["offset", String(offset)],
          ["index", sort],
        ];
        if (debounced) q.push(["query", debounced]);
        const f = facets();
        if (f.length) q.push(["facets", JSON.stringify(f)]);
        const r = await api.modrinth<SearchResult>("/search", q);
        if (id !== reqId.current) return;
        setTotal(r.total_hits);
        setHits((h) => (offset === 0 ? r.hits : [...h, ...r.hits]));
      } catch (e) {
        if (id === reqId.current) toast(errText(e), "error");
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [debounced, sort, facets],
  );

  useEffect(() => {
    setHits([]);
    load(0);
  }, [load]);

  // бесконечная прокрутка
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading && hits.length > 0 && hits.length < total) load(hits.length);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hits.length, total, loading, load]);

  const shownCats = allCats.filter((c) => (type ? c.project_type === type : c.project_type === "mod") && c.header === "categories");
  const toggle = (list: string[], v: string, set: (l: string[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="catalog">
      <div className="screen-head">
        <div className="tabs">
          <button className="tab" onClick={() => go("library")}>{tr("Библиотека", "Library")}</button>
          <button className="tab on">{tr("Каталог", "Catalog")}</button>
        </div>
        <input className="search" placeholder={tr("Поиск на Modrinth…", "Search Modrinth…")} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="tabs types">
        {TYPES.map((t) => (
          <button key={t.key} className={`tab ${type === t.key ? "on" : ""}`} onClick={() => { setType(t.key); setCats([]); }}>
            {tr(t.ru, t.en)}
          </button>
        ))}
      </div>
      <div className="catalog-body">
        <aside className="filters panel">
          <div className="filter-group">
            <div className="filter-title">{tr("Сортировка", "Sort")}</div>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>{tr(s.ru, s.en)}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <div className="filter-title">{tr("Версия игры", "Game version")}</div>
            <select value={gameVersion} onChange={(e) => setGameVersion(e.target.value)}>
              <option value="">{tr("Любая", "Any")}</option>
              {gameVersions.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          {(type === "" || type === "mod" || type === "modpack") && (
            <div className="filter-group">
              <div className="filter-title">{tr("Загрузчик", "Loader")}</div>
              {LOADERS.map((l) => (
                <label key={l} className="check">
                  <input type="checkbox" checked={loaders.includes(l)} onChange={() => toggle(loaders, l, setLoaders)} />
                  {l === "neoforge" ? "NeoForge" : l[0].toUpperCase() + l.slice(1)}
                </label>
              ))}
            </div>
          )}
          <div className="filter-group">
            <div className="filter-title">{tr("Окружение", "Environment")}</div>
            <div className="seg small">
              <button className={env === "" ? "on" : ""} onClick={() => setEnv("")}>{tr("Все", "All")}</button>
              <button className={env === "client" ? "on" : ""} onClick={() => setEnv("client")}>{tr("Клиент", "Client")}</button>
              <button className={env === "server" ? "on" : ""} onClick={() => setEnv("server")}>{tr("Сервер", "Server")}</button>
            </div>
          </div>
          {shownCats.length > 0 && (
            <div className="filter-group">
              <div className="filter-title">{tr("Категории", "Categories")}</div>
              {shownCats.map((c) => (
                <label key={c.name} className="check">
                  <input type="checkbox" checked={cats.includes(c.name)} onChange={() => toggle(cats, c.name, setCats)} />
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </aside>
        <div className="results">
          <div className="muted small">{tr("Найдено", "Found")}: {formatNumber(total)}</div>
          <div className="project-grid">
            {hits.map((h) => (
              <ProjectCard key={h.project_id} hit={h} />
            ))}
          </div>
          <div ref={sentinel} className="sentinel">{loading ? tr("Загрузка…", "Loading…") : hits.length >= total && total > 0 ? tr("Это всё", "That's all") : ""}</div>
          {!loading && total === 0 && <div className="empty muted">{tr("Ничего не найдено", "Nothing found")}</div>}
        </div>
      </div>
    </div>
  );
}
