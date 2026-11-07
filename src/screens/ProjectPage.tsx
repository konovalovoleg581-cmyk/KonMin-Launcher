// Страница проекта Modrinth: описание, галерея, версии, зависимости.
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, errText, formatNumber, type MrProject, type MrVersion } from "../lib/api";
import { useApp, useTr } from "../store";

interface DepProject {
  id: string;
  title: string;
  icon_url: string | null;
}

export function ProjectPage() {
  const tr = useTr();
  const { projectId, go, prevScreen, setModal, toast, openProject } = useApp();
  const [project, setProject] = useState<MrProject | null>(null);
  const [versions, setVersions] = useState<MrVersion[]>([]);
  const [deps, setDeps] = useState<DepProject[]>([]);
  const [tab, setTab] = useState<"desc" | "gallery" | "versions" | "deps">("desc");
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setProject(null);
    setVersions([]);
    setDeps([]);
    setTab("desc");
    api.modrinth<MrProject>(`/project/${projectId}`).then(setProject).catch((e) => toast(errText(e), "error"));
    api
      .modrinth<MrVersion[]>(`/project/${projectId}/version`)
      .then(async (v) => {
        setVersions(v);
        const ids = Array.from(new Set((v[0]?.dependencies ?? []).filter((d) => d.project_id && d.dependency_type === "required").map((d) => d.project_id!)));
        if (ids.length) setDeps(await api.modrinth<DepProject[]>("/projects", [["ids", JSON.stringify(ids)]]));
      })
      .catch(() => {});
  }, [projectId]);

  if (!project) return <div className="center pad muted">{tr("Загрузка…", "Loading…")}</div>;

  const install = (versionId?: string) =>
    setModal({ type: "install", projectId: project.id, projectType: project.project_type, title: project.title, versionId });

  return (
    <div className="project-page screen-scroll">
      <button className="px-btn ghost small" onClick={() => go(prevScreen === "project" ? "catalog" : prevScreen)}>← {tr("Назад", "Back")}</button>
      <div className="project-head panel">
        {project.icon_url && <img src={project.icon_url} width={96} height={96} alt="" className="p-icon-big" />}
        <div className="grow">
          <h1 className="pixel-title">{project.title}</h1>
          <p>{project.description}</p>
          <div className="p-tags">
            <span className="tag">⬇ {formatNumber(project.downloads)}</span>
            <span className="tag">♥ {formatNumber(project.followers)}</span>
            {project.loaders.slice(0, 5).map((l) => (
              <span key={l} className="tag">{l}</span>
            ))}
            {project.game_versions.length > 0 && <span className="tag">{project.game_versions[project.game_versions.length - 1]}</span>}
          </div>
        </div>
        <div className="col">
          <button className="px-btn" onClick={() => install()}>{tr("Установить", "Install")}</button>
          <button className="px-btn ghost small" onClick={() => api.openUrl(`https://modrinth.com/project/${project.slug}`)}>Modrinth ↗</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "desc" ? "on" : ""}`} onClick={() => setTab("desc")}>{tr("Описание", "Description")}</button>
        <button className={`tab ${tab === "gallery" ? "on" : ""}`} onClick={() => setTab("gallery")}>{tr("Галерея", "Gallery")} ({project.gallery.length})</button>
        <button className={`tab ${tab === "versions" ? "on" : ""}`} onClick={() => setTab("versions")}>{tr("Версии", "Versions")} ({versions.length})</button>
        <button className={`tab ${tab === "deps" ? "on" : ""}`} onClick={() => setTab("deps")}>{tr("Зависимости", "Dependencies")} ({deps.length})</button>
      </div>

      {tab === "desc" && (
        <div className="markdown panel pad">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (href?.startsWith("https://")) api.openUrl(href);
                  }}
                >
                  {children}
                </a>
              ),
            }}
          >
            {project.body}
          </ReactMarkdown>
        </div>
      )}

      {tab === "gallery" && (
        <div className="gallery">
          {project.gallery.length === 0 && <div className="muted">{tr("Нет изображений", "No images")}</div>}
          {project.gallery.map((g) => (
            <figure key={g.url} onClick={() => setLightbox(g.url)}>
              <img src={g.url} alt={g.title ?? ""} loading="lazy" />
              {g.title && <figcaption className="small">{g.title}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      {tab === "versions" && (
        <div className="panel">
          {versions.map((v) => (
            <div key={v.id} className="list-row">
              <span className={`tag ${v.version_type}`}>{v.version_type}</span>
              <div className="grow">
                <div>{v.name || v.version_number}</div>
                <div className="muted small">
                  {v.loaders.join(", ")} · {v.game_versions.slice(-4).join(", ")} · {new Date(v.date_published).toLocaleDateString()}
                </div>
              </div>
              <span className="muted small">⬇ {formatNumber(v.downloads)}</span>
              <button className="px-btn small" onClick={() => install(v.id)}>{tr("Установить", "Install")}</button>
            </div>
          ))}
        </div>
      )}

      {tab === "deps" && (
        <div className="panel">
          {deps.length === 0 && <div className="pad muted">{tr("Обязательных зависимостей нет", "No required dependencies")}</div>}
          {deps.map((d) => (
            <div key={d.id} className="list-row clickable" onClick={() => openProject(d.id)}>
              {d.icon_url && <img src={d.icon_url} width={32} height={32} alt="" />}
              <span className="grow">{d.title}</span>
              <span className="muted small">{tr("устанавливается автоматически", "installed automatically")}</span>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="modal-backdrop" onClick={() => setLightbox(null)}>
          <img src={lightbox} className="lightbox" alt="" />
        </div>
      )}
    </div>
  );
}
