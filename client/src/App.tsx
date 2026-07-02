// app.tsx — Whiteboard with Infinite Canvas (Feature 2)
// Changes from previous version:
//   • useViewport hook manages pan/zoom transform
//   • All shapes live in world space; mouse events convert screen→world
//   • Space + Drag to pan; Scroll / Ctrl+Scroll to zoom
//   • Grid tiles infinitely at any zoom level
//   • Canvas ctx.setTransform applied before every draw
//   • Zoom indicator in status bar

import { useEffect, useRef, useState, useCallback } from "react";
import "./index.css";
import { useViewport, screenToWorld, zoomToward } from "./hooks/useViewport";
import type { Point, Shape, PenShape, RectShape, Tool } from "./types/shape";

/* ================= CONSTANTS ================= */

const GRID_SIZE = 20;

const COLORS = [
  "#e2e8f0",
  "#60a5fa",
  "#f87171",
  "#4ade80",
  "#fbbf24",
  "#c084fc",
] as const;

const WIDTHS = [2, 4, 8] as const;

const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: "pen",    icon: "✏️", label: "Pen (P)"    },
  { id: "rect",   icon: "⬜", label: "Rect (R)"   },
  { id: "select", icon: "↖️", label: "Select (S)" },
  { id: "eraser", icon: "🧹", label: "Eraser (E)" },
];

/* ================= UTILS ================= */

function snapToGrid(p: Point): Point {
  return {
    x: Math.round(p.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(p.y / GRID_SIZE) * GRID_SIZE,
  };
}

function hitTest(p: Point, s: Shape): boolean {
  if (s.type === "rect") {
    const x1 = Math.min(s.start.x, s.end.x);
    const y1 = Math.min(s.start.y, s.end.y);
    const x2 = Math.max(s.start.x, s.end.x);
    const y2 = Math.max(s.start.y, s.end.y);
    return p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2;
  }
  if (s.type === "pen" && s.points.length >= 2) {
    const xs  = s.points.map(pt => pt.x);
    const ys  = s.points.map(pt => pt.y);
    const pad = Math.max(s.width, 10);
    return (
      p.x >= Math.min(...xs) - pad && p.x <= Math.max(...xs) + pad &&
      p.y >= Math.min(...ys) - pad && p.y <= Math.max(...ys) + pad
    );
  }
  return false;
}

function renderShape(ctx: CanvasRenderingContext2D, s: Shape, selected: boolean) {
  ctx.save();
  ctx.lineWidth = s.width;
  ctx.lineCap   = "round";
  ctx.lineJoin  = "round";

  if (s.type === "pen") {
    if (s.points.length < 2) { ctx.restore(); return; }
    ctx.strokeStyle = s.color;
    ctx.beginPath();
    s.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
  }

  if (s.type === "rect") {
    const x = Math.min(s.start.x, s.end.x);
    const y = Math.min(s.start.y, s.end.y);
    const w = Math.abs(s.end.x - s.start.x);
    const h = Math.abs(s.end.y - s.start.y);
    ctx.strokeStyle = selected ? "#60a5fa" : s.color;
    if (selected) {
      ctx.setLineDash([6, 3]);
      ctx.fillStyle = "rgba(96,165,250,0.06)";
      ctx.fillRect(x, y, w, h);
    }
    ctx.beginPath();
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }

  ctx.restore();
}

/** Draw an infinite grid in world space, scaled by the viewport. */
function renderGrid(
  ctx: CanvasRenderingContext2D,
  screenW: number,
  screenH: number,
  vpX: number,
  vpY: number,
  scale: number,
) {
  ctx.save();
  // Reset to screen space for grid drawing
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Dynamic grid size: double the cell when zoomed out far enough
  let gridPx = GRID_SIZE * scale;
  while (gridPx < 6) gridPx *= 4;
  while (gridPx > 80) gridPx /= 2;

  // Opacity fades at extreme zoom
  const alpha = Math.min(1, Math.max(0.04, (gridPx - 4) / 40)) * 0.18;
  ctx.strokeStyle = `rgba(148,163,184,${alpha})`;
  ctx.lineWidth   = 1;

  // Offset so grid lines align to world origin
  const offsetX = ((vpX % gridPx) + gridPx) % gridPx;
  const offsetY = ((vpY % gridPx) + gridPx) % gridPx;

  ctx.beginPath();
  for (let x = offsetX - gridPx; x <= screenW + gridPx; x += gridPx) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, screenH);
  }
  for (let y = offsetY - gridPx; y <= screenH + gridPx; y += gridPx) {
    ctx.moveTo(0,       Math.round(y) + 0.5);
    ctx.lineTo(screenW, Math.round(y) + 0.5);
  }
  ctx.stroke();

  ctx.restore();
}

function applyDpr(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width        = window.innerWidth  * dpr;
  canvas.height       = window.innerHeight * dpr;
  canvas.style.width  = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.scale(dpr, dpr);
}

function cloneShapes(arr: Shape[]): Shape[] {
  return JSON.parse(JSON.stringify(arr)) as Shape[];
}

function moveShape(s: Shape, dx: number, dy: number): Shape {
  if (s.type === "rect") {
    return {
      ...s,
      start: { x: s.start.x + dx, y: s.start.y + dy },
      end:   { x: s.end.x   + dx, y: s.end.y   + dy },
    };
  }
  return { ...s, points: s.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
}

/* ================= APP ================= */

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /* ── UI state ── */
  const [tool,       setTool]       = useState<Tool>("pen");
  const [showGrid,   setShowGrid]   = useState(false);
  const [snap,       setSnap]       = useState(false);
  const [color,      setColor]      = useState<string>(COLORS[0]);
  const [lineWidth,  setLineWidth]  = useState<number>(WIDTHS[0]);
  const [shapeCount, setShapeCount] = useState(0);

  /* ── Viewport ── */
  const { viewportRef, updateViewport, isPanning, panStart, isSpaceDown } =
    useViewport();
  const [displayScale, setDisplayScale] = useState(100);

  /* ── Canvas data refs ── */
  const shapesRef     = useRef<Shape[]>([]);
  const currentRef    = useRef<Shape | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const undoStack     = useRef<Shape[][]>([]);
  const redoStack     = useRef<Shape[][]>([]);
  const isDrawing     = useRef(false);
  const lastDragPt    = useRef<Point | null>(null);  // world-space drag anchor

  /* ── Stable mirrors ── */
  const toolRef     = useRef(tool);
  const snapRef     = useRef(snap);
  const colorRef    = useRef(color);
  const widthRef    = useRef(lineWidth);
  const showGridRef = useRef(showGrid);
  useEffect(() => { toolRef.current     = tool;      }, [tool]);
  useEffect(() => { snapRef.current     = snap;      }, [snap]);
  useEffect(() => { colorRef.current    = color;     }, [color]);
  useEffect(() => { widthRef.current    = lineWidth; }, [lineWidth]);
  useEffect(() => { showGridRef.current = showGrid;  }, [showGrid]);

  const syncCount = useCallback(() => setShapeCount(shapesRef.current.length), []);

  /* ── Redraw (applies viewport transform) ── */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr   = window.devicePixelRatio || 1;
    const vp    = viewportRef.current;
    const sw    = canvas.width  / dpr;   // logical screen width
    const sh    = canvas.height / dpr;   // logical screen height

    // Clear
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, sw, sh);

    // Grid (drawn in screen space inside the helper)
    if (showGridRef.current) {
      renderGrid(ctx, sw, sh, vp.x, vp.y, vp.scale);
      // Restore DPR scale after grid helper resets transform
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Apply viewport transform for world-space drawing
    ctx.save();
    ctx.translate(vp.x, vp.y);
    ctx.scale(vp.scale, vp.scale);

    shapesRef.current.forEach(s =>
      renderShape(ctx, s, s.id === selectedIdRef.current)
    );

    if (currentRef.current) {
      renderShape(ctx, currentRef.current, false);
    }

    ctx.restore();
  }, [viewportRef]);

  const saveUndo = useCallback(() => {
    undoStack.current.push(cloneShapes(shapesRef.current));
    redoStack.current = [];
  }, []);

  const undoAction = useCallback(() => {
    if (!undoStack.current.length) return;
    redoStack.current.push(cloneShapes(shapesRef.current));
    shapesRef.current     = undoStack.current.pop()!;
    selectedIdRef.current = null;
    redraw(); syncCount();
  }, [redraw, syncCount]);

  const redoAction = useCallback(() => {
    if (!redoStack.current.length) return;
    undoStack.current.push(cloneShapes(shapesRef.current));
    shapesRef.current     = redoStack.current.pop()!;
    selectedIdRef.current = null;
    redraw(); syncCount();
  }, [redraw, syncCount]);

  const undoRef = useRef(undoAction);
  const redoRef = useRef(redoAction);
  useEffect(() => { undoRef.current = undoAction; }, [undoAction]);
  useEffect(() => { redoRef.current = redoAction; }, [redoAction]);

  /* ================= MAIN CANVAS EFFECT ================= */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Coordinate helpers ─────────────────────────────────────────────────

    /** Screen point → world point (with optional snap). */
    function toWorld(e: MouseEvent): Point {
      const vp = viewportRef.current;
      const p  = screenToWorld({ x: e.clientX, y: e.clientY }, vp);
      return snapRef.current ? snapToGrid(p) : p;
    }

    // ── Resize ──────────────────────────────────────────────────────────────
    const onResize = () => { applyDpr(canvas, ctx); redraw(); };

    // ── Wheel: zoom or pan ──────────────────────────────────────────────────
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const focal = { x: e.clientX, y: e.clientY };

      // Ctrl+wheel or pinch = zoom
      if (e.ctrlKey || e.metaKey) {
        const next = zoomToward(viewportRef.current, focal, e.deltaY);
        updateViewport(next);
        setDisplayScale(Math.round(next.scale * 100));
        redraw();
        return;
      }

      // Trackpad two-finger pan (deltaMode === 0 = pixels)
      const vp  = viewportRef.current;
      const mul = e.deltaMode === 1 ? 20 : 1;   // line mode → px
      const next = {
        ...vp,
        x: vp.x - e.deltaX * mul,
        y: vp.y - e.deltaY * mul,
      };
      updateViewport(next);
      redraw();
    };

    // ── Keyboard: space ─────────────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.code === "Space") {
        e.preventDefault();
        isSpaceDown.current = true;
        canvas.style.cursor = "grab";
        return;
      }

      if (!e.ctrlKey && !e.metaKey) {
        if (e.key === "p") { setTool("pen");    toolRef.current = "pen";    return; }
        if (e.key === "r") { setTool("rect");   toolRef.current = "rect";   return; }
        if (e.key === "s") { setTool("select"); toolRef.current = "select"; return; }
        if (e.key === "e") { setTool("eraser"); toolRef.current = "eraser"; return; }
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedIdRef.current) {
        saveUndo();
        shapesRef.current     = shapesRef.current.filter(s => s.id !== selectedIdRef.current);
        selectedIdRef.current = null;
        redraw(); syncCount();
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") { e.preventDefault(); undoRef.current(); }
        if (e.key === "y") { e.preventDefault(); redoRef.current(); }
        // Zoom shortcuts
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          const focal = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
          const next  = zoomToward(viewportRef.current, focal, -200);
          updateViewport(next);
          setDisplayScale(Math.round(next.scale * 100));
          redraw();
        }
        if (e.key === "-") {
          e.preventDefault();
          const focal = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
          const next  = zoomToward(viewportRef.current, focal, 200);
          updateViewport(next);
          setDisplayScale(Math.round(next.scale * 100));
          redraw();
        }
        if (e.key === "0") {
          e.preventDefault();
          updateViewport({ x: 0, y: 0, scale: 1 });
          setDisplayScale(100);
          redraw();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        isSpaceDown.current = false;
        isPanning.current   = false;
        panStart.current    = null;
        canvas.style.cursor = cursorForTool(toolRef.current);
      }
    };

    // ── Mouse events ─────────────────────────────────────────────────────────

  const onDown = (e: MouseEvent) => {
  // ------------------------------------
  // Middle Mouse Button -> Pan
  // ------------------------------------
  if (e.button === 1) {
    e.preventDefault();

    isPanning.current = true;
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
    };

    canvas.style.cursor = "grabbing";
    return;
  }

  // ------------------------------------
  // Ignore Right Mouse Button
  // ------------------------------------
  if (e.button !== 0) {
    return;
  }

  // ------------------------------------
  // Space + Left Click -> Pan
  // ------------------------------------
  if (isSpaceDown.current) {
    isPanning.current = true;
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
    };

    canvas.style.cursor = "grabbing";
    return;
  }

  // ------------------------------------
  // Begin Drawing
  // ------------------------------------
  isDrawing.current = true;

  const world = toWorld(e);
  const t = toolRef.current;

  // ------------------------------------
  // Selection Tool
  // ------------------------------------
  if (t === "select") {
    selectedIdRef.current = null;

    for (let i = shapesRef.current.length - 1; i >= 0; i--) {
      if (hitTest(world, shapesRef.current[i])) {
        selectedIdRef.current = shapesRef.current[i].id;
        lastDragPt.current = world;
        break;
      }
    }

    redraw();
    return;
  }

  // ------------------------------------
  // Eraser Tool
  // ------------------------------------
  if (t === "eraser") {
    for (let i = shapesRef.current.length - 1; i >= 0; i--) {
      if (hitTest(world, shapesRef.current[i])) {
        saveUndo();

        shapesRef.current = shapesRef.current.filter((_, idx) => idx !== i);

        redraw();
        syncCount();
        return;
      }
    }

    return;
  }

  // ------------------------------------
  // Create New Shape
  // ------------------------------------
  const id = crypto.randomUUID();

  if (t === "pen") {
    currentRef.current = {
      id,
      type: "pen",
      points: [world],
      color: colorRef.current,
      width: widthRef.current,
    } satisfies PenShape;
  }

  if (t === "rect") {
    currentRef.current = {
      id,
      type: "rect",
      start: world,
      end: world,
      color: colorRef.current,
      width: widthRef.current,
    } satisfies RectShape;
  }
};

    const onMove = (e: MouseEvent) => {
      // Pan mode
      if (isPanning.current && panStart.current) {
        const dx  = e.clientX - panStart.current.x;
        const dy  = e.clientY - panStart.current.y;
        panStart.current = { x: e.clientX, y: e.clientY };
        const vp  = viewportRef.current;
        updateViewport({ ...vp, x: vp.x + dx, y: vp.y + dy });
        redraw();
        return;
      }

      const world = toWorld(e);
      const t     = toolRef.current;

      // Drag selected shape
      if (t === "select" && selectedIdRef.current && lastDragPt.current && isDrawing.current) {
        const dx = world.x - lastDragPt.current.x;
        const dy = world.y - lastDragPt.current.y;
        shapesRef.current = shapesRef.current.map(s =>
          s.id === selectedIdRef.current ? moveShape(s, dx, dy) : s
        );
        lastDragPt.current = world;
        redraw();
        return;
      }

      if (!isDrawing.current || !currentRef.current) return;

      if (currentRef.current.type === "pen") {
        (currentRef.current as PenShape).points.push(world);
      } else if (currentRef.current.type === "rect") {
        currentRef.current = { ...(currentRef.current as RectShape), end: world };
      }

      redraw();
    };

    const onUp = () => {
      if (isPanning.current) {
        isPanning.current = false;
        panStart.current  = null;
        canvas.style.cursor = isSpaceDown.current ? "grab" : cursorForTool(toolRef.current);
        return;
      }

      if (currentRef.current) {
        saveUndo();
        shapesRef.current  = [...shapesRef.current, currentRef.current];
        currentRef.current = null;
        syncCount();
      }

      isDrawing.current  = false;
      lastDragPt.current = null;
      redraw();
    };

    onResize();
    window.addEventListener("resize",    onResize);
    canvas.addEventListener("wheel",     onWheel,   { passive: false });
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    window.addEventListener("keydown",   onKeyDown);
    window.addEventListener("keyup",     onKeyUp);

    return () => {
      window.removeEventListener("resize",    onResize);
      canvas.removeEventListener("wheel",     onWheel);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
      window.removeEventListener("keydown",   onKeyDown);
      window.removeEventListener("keyup",     onKeyUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { redraw(); }, [showGrid, redraw]);

  /* ================= TOOLBAR ACTIONS ================= */

  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link    = document.createElement("a");
    link.download = "whiteboard.png";
    link.href     = canvas.toDataURL("image/png");
    link.click();
  }, []);

  const exportJSON = useCallback(() => {
    const data    = { shapes: shapesRef.current, viewport: viewportRef.current };
    const blob    = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url     = URL.createObjectURL(blob);
    const link    = document.createElement("a");
    link.download = "whiteboard.json";
    link.href     = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, [viewportRef]);

  const importJSON = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(text => {
      try {
        saveUndo();
        const parsed = JSON.parse(text) as { shapes?: Shape[]; viewport?: { x: number; y: number; scale: number } };
        // Support both old format (array) and new format (object with shapes + viewport)
        if (Array.isArray(parsed)) {
          shapesRef.current = parsed as Shape[];
        } else {
          shapesRef.current = parsed.shapes ?? [];
          if (parsed.viewport) {
            updateViewport(parsed.viewport);
            setDisplayScale(Math.round(parsed.viewport.scale * 100));
          }
        }
        redraw(); syncCount();
      } catch { console.error("Invalid JSON"); }
    });
    e.target.value = "";
  }, [saveUndo, redraw, syncCount, updateViewport]);

  const clearCanvas = useCallback(() => {
    saveUndo();
    shapesRef.current     = [];
    selectedIdRef.current = null;
    redraw(); syncCount();
  }, [saveUndo, redraw, syncCount]);

  const resetZoom = useCallback(() => {
    updateViewport({ x: 0, y: 0, scale: 1 });
    setDisplayScale(100);
    redraw();
  }, [updateViewport, redraw]);

  /* ================= CURSOR ================= */
  const cursor = cursorForTool(tool);

  /* ================= RENDER ================= */
  return (
    <>
      <canvas ref={canvasRef} style={{ display: "block", cursor }} />

      {/* ── Toolbar ── */}
      <div className="toolbar">
        <div className="toolbar-group">
          {TOOLS.map(t => (
            <button
              key={t.id}
              title={t.label}
              className={`tool-btn${tool === t.id ? " active" : ""}`}
              onClick={() => setTool(t.id)}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className="divider" />

        <div className="toolbar-group" style={{ gap: "5px" }}>
          {COLORS.map(c => (
            <button
              key={c}
              title={c}
              className={`color-swatch${color === c ? " active" : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>

        <div className="divider" />

        <div className="toolbar-group">
          {WIDTHS.map(w => (
            <button
              key={w}
              title={`${w}px`}
              className={`width-btn${lineWidth === w ? " active" : ""}`}
              onClick={() => setLineWidth(w)}
            >
              <span style={{
                display: "block",
                width: w * 5, height: w,
                background: color, borderRadius: 2,
              }} />
            </button>
          ))}
        </div>

        <div className="divider" />

        <div className="toolbar-group">
          <button className={`toggle-btn${showGrid ? " active" : ""}`} onClick={() => setShowGrid(v => !v)}>
            Grid
          </button>
          <button className={`toggle-btn${snap ? " active" : ""}`} onClick={() => setSnap(v => !v)}>
            Snap
          </button>
        </div>

        <div className="divider" />

        <div className="toolbar-group">
          <button className="action-btn icon-btn" title="Undo (Ctrl+Z)" onClick={undoAction}>↩</button>
          <button className="action-btn icon-btn" title="Redo (Ctrl+Y)" onClick={redoAction}>↪</button>
          <button className="action-btn" onClick={exportPNG}>PNG</button>
          <button className="action-btn" onClick={exportJSON}>JSON</button>
          <label className="action-btn" style={{ cursor: "pointer" }}>
            Import
            <input type="file" accept=".json" hidden onChange={importJSON} />
          </label>
          <button className="action-btn danger" onClick={clearCanvas}>Clear</button>
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div className="statusbar">
        <div className="statusbar-left">
          <div className="statusbar-dot" />
          <span>{shapeCount} shape{shapeCount !== 1 ? "s" : ""}</span>
          <span style={{ textTransform: "capitalize" }}>{tool}</span>
          <span style={{ color: "rgba(148,163,184,0.4)" }}>·</span>
          <span>Space+drag to pan</span>
        </div>
        <div className="statusbar-right">
          <button
            onClick={resetZoom}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "rgba(148,163,184,0.8)", fontFamily: "var(--font-mono,DM Mono,monospace)",
              fontSize: 11, padding: "0 4px",
            }}
            title="Reset zoom (Ctrl+0)"
          >
            {displayScale}%
          </button>
          <span>{lineWidth}px</span>
          <span style={{
            display: "inline-block", width: 10, height: 10, borderRadius: "50%",
            background: color, border: "1px solid rgba(255,255,255,0.2)", verticalAlign: "middle",
          }} />
          <span>{showGrid ? "grid on" : "grid off"}</span>
          <span>{snap ? "snap on" : "snap off"}</span>
        </div>
      </div>
    </>
  );
}

function cursorForTool(t: Tool): string {
  if (t === "pen" || t === "rect") return "crosshair";
  if (t === "eraser")              return "cell";
  return "default";
}
