// App.tsx — Whiteboard with Infinite Canvas + Real-time Collaboration
//
// Feature 3 diff vs Feature 2:
//   + Accepts boardId / token props from Whiteboard page
//   + useCollaboration wired to canvas shape refs (onSnapshot / onRemoteCreate / onRemoteUpdate / onRemoteDelete)
//   + sendOp.createShape()  called on draw commit
//   + sendOp.updateShape()  called on drag-move mouseup
//   + sendOp.deleteShape()  called on eraser hit and Delete key
//   + CollaboratorCursors overlay (client-only, future-ready)
//   + Status dot reflects real WS connection state
//   All drawing logic, viewport, grid, undo/redo — UNCHANGED

import { useEffect, useRef, useState, useCallback } from "react";
import "./index.css";
import { useViewport, screenToWorld, zoomToward } from "./hooks/useViewport";
import { useCollaboration } from "./hooks/useCollaboration";
import CollaboratorCursors from "./components/CollaboratorCursors";
import type { Point, Shape, PenShape, RectShape, Tool } from "./types/shape";

/* ──────────────────────────────────────────────────────────────────────────────
   CONSTANTS
────────────────────────────────────────────────────────────────────────────── */

const GRID_SIZE = 20;

const COLORS = [
  "#e2e8f0", "#60a5fa", "#f87171",
  "#4ade80", "#fbbf24", "#c084fc",
] as const;

const WIDTHS = [2, 4, 8] as const;

const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: "pen",    icon: "✏️", label: "Pen (P)"    },
  { id: "rect",   icon: "⬜", label: "Rect (R)"   },
  { id: "select", icon: "↖️", label: "Select (S)" },
  { id: "eraser", icon: "🧹", label: "Eraser (E)" },
];

/* ──────────────────────────────────────────────────────────────────────────────
   PURE CANVAS UTILITIES  (unchanged from Feature 2)
────────────────────────────────────────────────────────────────────────────── */

function snapToGrid(p: Point): Point {
  return {
    x: Math.round(p.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(p.y / GRID_SIZE) * GRID_SIZE,
  };
}

function hitTest(p: Point, s: Shape): boolean {
  if (s.type === "rect") {
    const x1 = Math.min(s.start.x, s.end.x), y1 = Math.min(s.start.y, s.end.y);
    const x2 = Math.max(s.start.x, s.end.x), y2 = Math.max(s.start.y, s.end.y);
    return p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2;
  }
  if (s.type === "pen" && s.points.length >= 2) {
    const xs = s.points.map(pt => pt.x), ys = s.points.map(pt => pt.y);
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
  ctx.lineWidth = s.width; ctx.lineCap = "round"; ctx.lineJoin = "round";

  if (s.type === "pen") {
    if (s.points.length < 2) { ctx.restore(); return; }
    ctx.strokeStyle = s.color;
    ctx.beginPath();
    s.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
  }
  if (s.type === "rect") {
    const x = Math.min(s.start.x, s.end.x), y = Math.min(s.start.y, s.end.y);
    const w = Math.abs(s.end.x - s.start.x),  h = Math.abs(s.end.y - s.start.y);
    ctx.strokeStyle = selected ? "#60a5fa" : s.color;
    if (selected) {
      ctx.setLineDash([6, 3]);
      ctx.fillStyle = "rgba(96,165,250,0.06)";
      ctx.fillRect(x, y, w, h);
    }
    ctx.beginPath(); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
  }
  ctx.restore();
}

function renderGrid(
  ctx: CanvasRenderingContext2D,
  screenW: number, screenH: number,
  vpX: number, vpY: number, scale: number,
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  let gridPx = GRID_SIZE * scale;
  while (gridPx < 6)  gridPx *= 4;
  while (gridPx > 80) gridPx /= 2;
  const alpha   = Math.min(1, Math.max(0.04, (gridPx - 4) / 40)) * 0.18;
  ctx.strokeStyle = `rgba(148,163,184,${alpha})`;
  ctx.lineWidth   = 1;
  const offsetX = ((vpX % gridPx) + gridPx) % gridPx;
  const offsetY = ((vpY % gridPx) + gridPx) % gridPx;
  ctx.beginPath();
  for (let x = offsetX - gridPx; x <= screenW + gridPx; x += gridPx) {
    ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, screenH);
  }
  for (let y = offsetY - gridPx; y <= screenH + gridPx; y += gridPx) {
    ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(screenW, Math.round(y) + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

function applyDpr(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width  = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.scale(dpr, dpr);
}

function cloneShapes(arr: Shape[]): Shape[] {
  return JSON.parse(JSON.stringify(arr)) as Shape[];
}

function moveShape(s: Shape, dx: number, dy: number): Shape {
  if (s.type === "rect") return {
    ...s,
    start: { x: s.start.x + dx, y: s.start.y + dy },
    end:   { x: s.end.x   + dx, y: s.end.y   + dy },
  };
  return { ...s, points: s.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
}

function cursorForTool(t: Tool): string {
  if (t === "pen" || t === "rect") return "crosshair";
  if (t === "eraser")              return "cell";
  return "default";
}

/* ──────────────────────────────────────────────────────────────────────────────
   PROPS  (new in Feature 3)
────────────────────────────────────────────────────────────────────────────── */

interface AppProps {
  /** Board UUID from the URL — enables collaboration when present. */
  boardId?: string;
  /** JWT from AuthContext — passed directly to WebSocketService. */
  token?:   string | null;
}

/* ──────────────────────────────────────────────────────────────────────────────
   COMPONENT
────────────────────────────────────────────────────────────────────────────── */

export default function App({ boardId, token }: AppProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [tool,         setTool]         = useState<Tool>("pen");
  const [showGrid,     setShowGrid]     = useState(false);
  const [snap,         setSnap]         = useState(false);
  const [color,        setColor]        = useState<string>(COLORS[0]);
  const [lineWidth,    setLineWidth]    = useState<number>(WIDTHS[0]);
  const [shapeCount,   setShapeCount]   = useState(0);
  const [displayScale, setDisplayScale] = useState(100);

  // ── Viewport ──────────────────────────────────────────────────────────────
  const { viewport, viewportRef, updateViewport, isPanning, panStart, isSpaceDown } =
    useViewport();

  // ── Canvas data refs (never cause React re-renders) ───────────────────────
  const shapesRef     = useRef<Shape[]>([]);
  const currentRef    = useRef<Shape | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const undoStack     = useRef<Shape[][]>([]);
  const redoStack     = useRef<Shape[][]>([]);
  const isDrawing     = useRef(false);
  const lastDragPt    = useRef<Point | null>(null);

  // ── Stable mirrors of React state (read inside event listeners) ───────────
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

  // ── Redraw ────────────────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const vp  = viewportRef.current;
    const sw  = canvas.width  / dpr;
    const sh  = canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, sw, sh);

    if (showGridRef.current) {
      renderGrid(ctx, sw, sh, vp.x, vp.y, vp.scale);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    ctx.save();
    ctx.translate(vp.x, vp.y);
    ctx.scale(vp.scale, vp.scale);
    shapesRef.current.forEach(s => renderShape(ctx, s, s.id === selectedIdRef.current));
    if (currentRef.current) renderShape(ctx, currentRef.current, false);
    ctx.restore();
  }, [viewportRef]);

  const saveUndo = useCallback(() => {
    undoStack.current.push(cloneShapes(shapesRef.current));
    redoStack.current = [];
  }, []);

  // ── Collaboration ─────────────────────────────────────────────────────────
  const { status: wsStatus, sendOp } = useCollaboration({
    boardId,
    token: token ?? null,

    onSnapshot: useCallback((shapes: Shape[]) => {
      shapesRef.current = shapes;
      redraw();
      syncCount();
    }, [redraw, syncCount]),

    onRemoteCreate: useCallback((shape: Shape) => {
      if (shapesRef.current.some(s => s.id === shape.id)) return; // echo guard
      shapesRef.current = [...shapesRef.current, shape];
      redraw(); syncCount();
    }, [redraw, syncCount]),

    onRemoteUpdate: useCallback((shape: Shape) => {
      shapesRef.current = shapesRef.current.map(s => s.id === shape.id ? shape : s);
      redraw();
    }, [redraw]),

    onRemoteDelete: useCallback((shapeId: string) => {
      shapesRef.current = shapesRef.current.filter(s => s.id !== shapeId);
      if (selectedIdRef.current === shapeId) selectedIdRef.current = null;
      redraw(); syncCount();
    }, [redraw, syncCount]),
  });

  // Stable ref so event handlers always get the latest sendOp
  const sendOpRef = useRef(sendOp);
  useEffect(() => { sendOpRef.current = sendOp; }, [sendOp]);

  // ── Undo / Redo ───────────────────────────────────────────────────────────
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

  /* ─────────────────────────────────────────────────────────────────────────
     MAIN CANVAS EFFECT  (runs once — all live values via stable refs)
  ───────────────────────────────────────────────────────────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function toWorld(e: MouseEvent): Point {
      const p = screenToWorld({ x: e.clientX, y: e.clientY }, viewportRef.current);
      return snapRef.current ? snapToGrid(p) : p;
    }

    // ── Resize ──
    const onResize = () => { applyDpr(canvas, ctx); redraw(); };

    // ── Wheel: zoom (Ctrl) or pan (trackpad) ──
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const focal = { x: e.clientX, y: e.clientY };
      if (e.ctrlKey || e.metaKey) {
        const next = zoomToward(viewportRef.current, focal, e.deltaY);
        updateViewport(next);
        setDisplayScale(Math.round(next.scale * 100));
      } else {
        const vp  = viewportRef.current;
        const mul = e.deltaMode === 1 ? 20 : 1;
        updateViewport({ ...vp, x: vp.x - e.deltaX * mul, y: vp.y - e.deltaY * mul });
      }
      redraw();
    };

    // ── Keyboard ──
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

      // Delete / Backspace
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIdRef.current) {
        saveUndo();
        const id = selectedIdRef.current;
        shapesRef.current     = shapesRef.current.filter(s => s.id !== id);
        selectedIdRef.current = null;
        sendOpRef.current.deleteShape(id);   // ← NEW: broadcast delete
        redraw(); syncCount();
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") { e.preventDefault(); undoRef.current(); return; }
        if (e.key === "y") { e.preventDefault(); redoRef.current(); return; }
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          const focal = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
          const next  = zoomToward(viewportRef.current, focal, -200);
          updateViewport(next); setDisplayScale(Math.round(next.scale * 100)); redraw();
        }
        if (e.key === "-") {
          e.preventDefault();
          const focal = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
          const next  = zoomToward(viewportRef.current, focal, 200);
          updateViewport(next); setDisplayScale(Math.round(next.scale * 100)); redraw();
        }
        if (e.key === "0") {
          e.preventDefault();
          updateViewport({ x: 0, y: 0, scale: 1 }); setDisplayScale(100); redraw();
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

    // ── Mouse down ──
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;

      if (isSpaceDown.current) {
        isPanning.current   = true;
        panStart.current    = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = "grabbing";
        return;
      }

      isDrawing.current = true;
      const world = toWorld(e);
      const t     = toolRef.current;

      if (t === "select") {
        selectedIdRef.current = null;
        for (let i = shapesRef.current.length - 1; i >= 0; i--) {
          if (hitTest(world, shapesRef.current[i])) {
            selectedIdRef.current = shapesRef.current[i].id;
            lastDragPt.current    = world;
            break;
          }
        }
        redraw();
        return;
      }

      if (t === "eraser") {
        for (let i = shapesRef.current.length - 1; i >= 0; i--) {
          if (hitTest(world, shapesRef.current[i])) {
            saveUndo();
            const id      = shapesRef.current[i].id;
            shapesRef.current = shapesRef.current.filter((_, idx) => idx !== i);
            sendOpRef.current.deleteShape(id);   // ← NEW: broadcast delete
            redraw(); syncCount();
            return;
          }
        }
        return;
      }

      const id = crypto.randomUUID();
      if (t === "pen") {
        currentRef.current = {
          id, type: "pen", points: [world],
          color: colorRef.current, width: widthRef.current,
        } satisfies PenShape;
      } else if (t === "rect") {
        currentRef.current = {
          id, type: "rect", start: world, end: world,
          color: colorRef.current, width: widthRef.current,
        } satisfies RectShape;
      }
    };

    // ── Mouse move ──
    const onMove = (e: MouseEvent) => {
      if (isPanning.current && panStart.current) {
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        panStart.current = { x: e.clientX, y: e.clientY };
        const vp = viewportRef.current;
        updateViewport({ ...vp, x: vp.x + dx, y: vp.y + dy });
        redraw();
        return;
      }

      const world = toWorld(e);
      const t     = toolRef.current;

      if (t === "select" && selectedIdRef.current && lastDragPt.current && isDrawing.current) {
        const dx = world.x - lastDragPt.current.x;
        const dy = world.y - lastDragPt.current.y;
        shapesRef.current  = shapesRef.current.map(s =>
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

    // ── Mouse up ──
    const onUp = () => {
      if (isPanning.current) {
        isPanning.current   = false;
        panStart.current    = null;
        canvas.style.cursor = isSpaceDown.current ? "grab" : cursorForTool(toolRef.current);
        return;
      }

      // Commit drawn shape → broadcast CREATE
      if (currentRef.current) {
        const finished     = currentRef.current;
        saveUndo();
        shapesRef.current  = [...shapesRef.current, finished];
        currentRef.current = null;
        sendOpRef.current.createShape(finished);  // ← NEW: broadcast create
        syncCount();
      }

      // Commit moved shape → broadcast UPDATE
      if (toolRef.current === "select" && selectedIdRef.current && lastDragPt.current) {
        const moved = shapesRef.current.find(s => s.id === selectedIdRef.current);
        if (moved) sendOpRef.current.updateShape(moved); // ← NEW: broadcast update
      }

      isDrawing.current  = false;
      lastDragPt.current = null;
      redraw();
    };

    onResize();
    window.addEventListener("resize",    onResize);
    canvas.addEventListener("wheel",     onWheel,  { passive: false });
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

  /* ─────────────────────────────────────────────────────────────────────────
     TOOLBAR ACTIONS  (unchanged from Feature 2)
  ───────────────────────────────────────────────────────────────────────── */

  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "whiteboard.png";
    link.href     = canvas.toDataURL("image/png");
    link.click();
  }, []);

  const exportJSON = useCallback(() => {
    const data = { shapes: shapesRef.current, viewport: viewportRef.current };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
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
        const parsed = JSON.parse(text) as { shapes?: Shape[]; viewport?: typeof viewportRef.current };
        shapesRef.current = Array.isArray(parsed) ? (parsed as Shape[]) : (parsed.shapes ?? []);
        if (!Array.isArray(parsed) && parsed.viewport) {
          updateViewport(parsed.viewport);
          setDisplayScale(Math.round(parsed.viewport.scale * 100));
        }
        redraw(); syncCount();
      } catch { console.error("Invalid JSON"); }
    });
    e.target.value = "";
  }, [saveUndo, redraw, syncCount, updateViewport, viewportRef]);

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

  /* ─────────────────────────────────────────────────────────────────────────
     STATUS BAR HELPERS
  ───────────────────────────────────────────────────────────────────────── */

  const statusColor =
    wsStatus === "connected"  ? "#10B981" :
    wsStatus === "connecting" ? "#F59E0B" :
    wsStatus === "error"      ? "#EF4444" :
    "rgba(148,163,184,0.3)";

  const statusLabel =
    wsStatus === "connected"  ? "live" :
    wsStatus === "connecting" ? "connecting…" :
    wsStatus === "error"      ? "reconnecting…" :
    boardId                   ? "offline" : "local";

  /* ─────────────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────────────── */

  return (
    <>
      <canvas ref={canvasRef} style={{ display: "block", cursor: cursorForTool(tool) }} />

      {/* Cursor overlay — populated when backend adds cursor ops */}
      <CollaboratorCursors cursors={[]} viewport={viewport} />

      {/* ── Toolbar ── */}
      <div className="toolbar">
        <div className="toolbar-group">
          {TOOLS.map(t => (
            <button key={t.id} title={t.label}
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
            <button key={c} title={c}
              className={`color-swatch${color === c ? " active" : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>

        <div className="divider" />

        <div className="toolbar-group">
          {WIDTHS.map(w => (
            <button key={w} title={`${w}px`}
              className={`width-btn${lineWidth === w ? " active" : ""}`}
              onClick={() => setLineWidth(w)}
            >
              <span style={{ display: "block", width: w * 5, height: w, background: color, borderRadius: 2 }} />
            </button>
          ))}
        </div>

        <div className="divider" />

        <div className="toolbar-group">
          <button className={`toggle-btn${showGrid ? " active" : ""}`} onClick={() => setShowGrid(v => !v)}>Grid</button>
          <button className={`toggle-btn${snap    ? " active" : ""}`} onClick={() => setSnap(v => !v)}>Snap</button>
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
          <div className="statusbar-dot"
            style={{ background: statusColor, boxShadow: `0 0 0 2px ${statusColor}33` }}
          />
          <span>{statusLabel}</span>
          <span style={{ color: "rgba(148,163,184,0.4)" }}>·</span>
          <span>{shapeCount} shape{shapeCount !== 1 ? "s" : ""}</span>
          <span style={{ textTransform: "capitalize" }}>{tool}</span>
        </div>
        <div className="statusbar-right">
          <button onClick={resetZoom} title="Reset zoom (Ctrl+0)"
            style={{ background: "transparent", border: "none", cursor: "pointer",
              color: "rgba(148,163,184,0.8)", fontFamily: "var(--font-mono,DM Mono,monospace)",
              fontSize: 11, padding: "0 4px" }}
          >
            {displayScale}%
          </button>
          <span>{lineWidth}px</span>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%",
            background: color, border: "1px solid rgba(255,255,255,0.2)", verticalAlign: "middle" }} />
          <span>{showGrid ? "grid on" : "grid off"}</span>
          <span>{snap    ? "snap on" : "snap off"}</span>
        </div>
      </div>
    </>
  );
}

