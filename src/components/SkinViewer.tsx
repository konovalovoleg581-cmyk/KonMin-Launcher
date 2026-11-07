// 3D-превью скина на skinview3d (вращение мышью, idle/ходьба).
import { useEffect, useRef } from "react";
import * as skinview3d from "skinview3d";

/** Стандартный скин KonMin (рисуется на canvas, без чужих ассетов). */
let defaultSkinCache: string | null = null;
export function defaultSkin(): string {
  if (defaultSkinCache) return defaultSkinCache;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d")!;
  const fill = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  // голова (все грани)
  fill(0, 8, 32, 8, "#e0b48c");
  fill(8, 0, 16, 8, "#e0b48c");
  fill(8, 0, 8, 8, "#3a2a20"); // макушка — волосы
  fill(0, 8, 8, 3, "#3a2a20");
  fill(16, 8, 16, 3, "#3a2a20");
  fill(8, 8, 8, 2, "#3a2a20"); // чёлка
  fill(9, 12, 2, 1, "#ffffff");
  fill(13, 12, 2, 1, "#ffffff");
  fill(10, 12, 1, 1, "#5b3cc4");
  fill(13, 12, 1, 1, "#5b3cc4");
  fill(11, 14, 2, 1, "#a86b4c");
  // тело — фиолетовое худи
  fill(16, 16, 24, 16, "#7c4dff");
  fill(20, 20, 8, 12, "#6a3df0");
  fill(23, 20, 2, 6, "#c8b6ff");
  // руки
  fill(40, 16, 16, 16, "#7c4dff");
  fill(40, 28, 16, 4, "#e0b48c");
  fill(32, 48, 16, 16, "#7c4dff");
  fill(32, 60, 16, 4, "#e0b48c");
  // ноги
  fill(0, 16, 16, 16, "#2b2f4a");
  fill(16, 48, 16, 16, "#2b2f4a");
  fill(0, 28, 16, 4, "#1a1626");
  fill(16, 60, 16, 4, "#1a1626");
  defaultSkinCache = c.toDataURL("image/png");
  return defaultSkinCache;
}

interface Props {
  skin: string | null;
  cape?: string | null;
  slim?: boolean;
  walking?: boolean;
  className?: string;
  zoom?: number;
}

export function SkinViewer({ skin, cape, slim, walking, className, zoom = 0.85 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<skinview3d.SkinViewer | null>(null);

  useEffect(() => {
    if (!canvas.current || !wrap.current) return;
    const v = new skinview3d.SkinViewer({
      canvas: canvas.current,
      width: wrap.current.clientWidth || 300,
      height: wrap.current.clientHeight || 400,
    });
    v.controls.enableZoom = false;
    v.controls.enablePan = false;
    v.zoom = zoom;
    v.fov = 40;
    viewer.current = v;
    const ro = new ResizeObserver(() => {
      if (wrap.current) v.setSize(wrap.current.clientWidth, wrap.current.clientHeight);
    });
    ro.observe(wrap.current);
    return () => {
      ro.disconnect();
      v.dispose();
      viewer.current = null;
    };
  }, [zoom]);

  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    v.loadSkin(skin || defaultSkin(), { model: slim ? "slim" : "default" });
    if (cape) v.loadCape(cape);
    else v.resetCape();
  }, [skin, cape, slim, zoom]);

  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    v.animation = walking ? new skinview3d.WalkingAnimation() : new skinview3d.IdleAnimation();
    if (v.animation) v.animation.speed = walking ? 0.7 : 1;
  }, [walking, zoom]);

  return (
    <div ref={wrap} className={className} style={{ width: "100%", height: "100%", cursor: "grab" }}>
      <canvas ref={canvas} />
    </div>
  );
}
