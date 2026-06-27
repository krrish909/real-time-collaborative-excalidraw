// app.tsx — Modern SaaS Whiteboard
// Replace your entire app.tsx with this file
// Make sure app.css is imported in main.tsx:  import './app.css'

import { useEffect, useRef, useState, useCallback } from "react";
  // ← add this if not already in main.tsx

/* ================= TYPES ================= */

export type Point = { x: number; y: number };

export type PenShape  = { id: string; type: "pen";  points: Point[]; color: string; width: number };
export type RectShape = { id: string; type: "rect"; start: Point; end: Point; color: string; width: number };
export type Shape     = PenShape | RectShape;
export type Tool      = "pen" | "rect" | "select" | "eraser";

/* ================= CONSTANTS ================= */

const GRID_SIZE = 20;   

const COLORS = [
  "#e2e8f0",  // light (default on dark canvas)
  "#60a5fa",  // blue
  "#f87171",  // red
  "#4ade80",  // green
  "#fbbf24",  // amber
  "#c084fc",  // purple
] as const;

const WIDTHS = [2, 4, 8] as const;

const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: "pen",    icon: "✏️", label: "Pen (P)"     },
  { id: "rect",   icon: "⬜", label: "Rect (R)"    },
  { id: "select", icon: "↖️", label: "Select (S)"  },
  { id: "eraser", icon: "🧹", label: "Eraser (E)"  },
];

/* ================= DRAW UTILS ================= */

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
  ctx.lineWidth  = s.width;
  ctx.lineCap    = "round";
  ctx.lineJoin   = "round";

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
      // subtle fill on selected
      ctx.fillStyle = "rgba(96,165,250,0.06)";
      ctx.fillRect(x, y, w, h);
    }
    ctx.beginPath();
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function renderGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(148,163,184,0.10)";
  ctx.lineWidth   = 1;
  for (let x = 0; x <= w; x += GRID_SIZE) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += GRID_SIZE) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.restore();
}

function applyDpr(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width        = window.innerWidth  * dpr;
  canvas.height       = window.innerHeight * dpr;
  canvas.style.width  = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function cloneShapes(arr: Shape[]): Shape[] {
  return JSON.parse(JSON.stringify(arr));
}

function moveShapes(shapes: Shape[], id: string, dx: number, dy: number): Shape[] {
  return shapes.map((s): Shape => {
    if (s.id !== id) return s;
    if (s.type === "rect") return { ...s, start: { x: s.start.x+dx, y: s.start.y+dy }, end: { x: s.end.x+dx, y: s.end.y+dy } };
    return { ...s, points: s.points.map(p => ({ x: p.x+dx, y: p.y+dy })) };
  });
}

/* ================= APP ================= */

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /* ── UI state ── */
  const [tool,      setTool]      = useState<Tool>("pen");
  const [showGrid,  setShowGrid]  = useState(false);
  const [snap,      setSnap]      = useState(false);
  const [color,     setColor]     = useState<string>(COLORS[0]);
  const [lineWidth, setLineWidth] = useState<number>(WIDTHS[0]);
  const [shapeCount, setShapeCount] = useState(0);

  /* ── Canvas data refs (no re-render on mouse events) ── */
  const shapesRef     = useRef<Shape[]>([]);
  const currentRef    = useRef<Shape | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const undoStack     = useRef<Shape[][]>([]);
  const redoStack     = useRef<Shape[][]>([]);
  const isDrawing     = useRef(false);
  const lastDragPt    = useRef<Point | null>(null);

  /* ── Stable mirrors so the single useEffect never goes stale ── */
  const toolRef      = useRef(tool);
  const snapRef      = useRef(snap);
  const colorRef     = useRef(color);
  const widthRef     = useRef(lineWidth);
  const showGridRef  = useRef(showGrid);
  useEffect(() => { toolRef.current     = tool;      }, [tool]);
  useEffect(() => { snapRef.current     = snap;      }, [snap]);
  useEffect(() => { colorRef.current    = color;     }, [color]);
  useEffect(() => { widthRef.current    = lineWidth; }, [lineWidth]);
  useEffect(() => { showGridRef.current = showGrid;  }, [showGrid]);

  /* ── Lightweight re-render for count ── */
  const syncCount = useCallback(() => setShapeCount(shapesRef.current.length), []);

  /* ── Redraw ── */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    if (showGridRef.current) renderGrid(ctx, canvas.width / dpr, canvas.height / dpr);
    shapesRef.current.forEach(s => renderShape(ctx, s, s.id === selectedIdRef.current));
  }, []);

  const saveUndo = useCallback(() => {
    undoStack.current.push(cloneShapes(shapesRef.current));
    redoStack.current = [];
  }, []);

  /* ── Undo / Redo ── */
  const undoAction = useCallback(() => {
    if (!undoStack.current.length) return;
    redoStack.current.push(cloneShapes(shapesRef.current));
    shapesRef.current   = undoStack.current.pop()!;
    selectedIdRef.current = null;
    redraw(); syncCount();
  }, [redraw, syncCount]);

  const redoAction = useCallback(() => {
    if (!redoStack.current.length) return;
    undoStack.current.push(cloneShapes(shapesRef.current));
    shapesRef.current   = redoStack.current.pop()!;
    selectedIdRef.current = null;
    redraw(); syncCount();
  }, [redraw, syncCount]);

  /* Stable refs for keyboard handler */
  const undoRef = useRef(undoAction);
  const redoRef = useRef(redoAction);
  useEffect(() => { undoRef.current = undoAction; }, [undoAction]);
  useEffect(() => { redoRef.current = redoAction; }, [redoAction]);

  /* ================= MAIN CANVAS EFFECT (runs once) ================= */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const getPoint = (e: MouseEvent): Point => {
      const p: Point = { x: e.clientX, y: e.clientY };
      return snapRef.current ? snapToGrid(p) : p;
    };

    const onResize = () => { applyDpr(canvas, ctx); redraw(); };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDrawing.current = true;
      const p = getPoint(e);
      const t = toolRef.current;

      if (t === "select") {
        selectedIdRef.current = null;
        for (let i = shapesRef.current.length - 1; i >= 0; i--) {
          if (hitTest(p, shapesRef.current[i])) {
            selectedIdRef.current = shapesRef.current[i].id;
            lastDragPt.current    = p;
            break;
          }
        }
        redraw();
        return;
      }

      if (t === "eraser") {
        for (let i = shapesRef.current.length - 1; i >= 0; i--) {
          if (hitTest(p, shapesRef.current[i])) {
            saveUndo();
            shapesRef.current = shapesRef.current.filter((_, idx) => idx !== i);
            redraw(); syncCount();
            return;
          }
        }
        return;
      }

      const id = crypto.randomUUID();
      const c  = colorRef.current;
      const lw = widthRef.current;

      if (t === "pen") {
        currentRef.current = { id, type: "pen",  points: [p], color: c, width: lw };
      } else if (t === "rect") {
        currentRef.current = { id, type: "rect", start: p, end: p, color: c, width: lw };
      }
    };

    const onMove = (e: MouseEvent) => {
      const p = getPoint(e);
      const t = toolRef.current;

      if (t === "select" && selectedIdRef.current && lastDragPt.current) {
        const dx = p.x - lastDragPt.current.x;
        const dy = p.y - lastDragPt.current.y;
        shapesRef.current = moveShapes(shapesRef.current, selectedIdRef.current, dx, dy);
        lastDragPt.current = p;
        redraw();
        return;
      }

      if (!isDrawing.current || !currentRef.current) return;

      if (currentRef.current.type === "pen") {
        currentRef.current.points.push(p);
      } else if (currentRef.current.type === "rect") {
        currentRef.current = { ...(currentRef.current as RectShape), end: p };
      }

      redraw();
      const ctx2 = canvas.getContext("2d");
      if (ctx2 && currentRef.current) renderShape(ctx2, currentRef.current, false);
    };

    const onUp = () => {
      if (currentRef.current) {
        saveUndo();
        shapesRef.current = [...shapesRef.current, currentRef.current];
        currentRef.current = null;
        syncCount();
      }
      isDrawing.current  = false;
      lastDragPt.current = null;
      redraw();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey) {
        if (e.key === "p") { toolRef.current = "pen";    setTool("pen");    return; }
        if (e.key === "r") { toolRef.current = "rect";   setTool("rect");   return; }
        if (e.key === "s") { toolRef.current = "select"; setTool("select"); return; }
        if (e.key === "e") { toolRef.current = "eraser"; setTool("eraser"); return; }
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
      }
    };

    onResize();
    window.addEventListener("resize",    onResize);
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    window.addEventListener("keydown",   onKey);

    return () => {
      window.removeEventListener("resize",    onResize);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
      window.removeEventListener("keydown",   onKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — all live values via stable refs

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
    const blob    = new Blob([JSON.stringify(shapesRef.current, null, 2)], { type: "application/json" });
    const url     = URL.createObjectURL(blob);
    const link    = document.createElement("a");
    link.download = "whiteboard.json";
    link.href     = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, []);

  const importJSON = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(text => {
      try {
        saveUndo();
        shapesRef.current = JSON.parse(text) as Shape[];
        redraw(); syncCount();
      } catch { console.error("Invalid JSON"); }
    });
    e.target.value = "";
  }, [saveUndo, redraw, syncCount]);

  const clearCanvas = useCallback(() => {
    saveUndo();
    shapesRef.current     = [];
    selectedIdRef.current = null;
    redraw(); syncCount();
  }, [saveUndo, redraw, syncCount]);

  /* ================= CURSOR ================= */
  const cursor =
    tool === "pen" || tool === "rect" ? "crosshair"
    : tool === "eraser"              ? "cell"
    : "default";

  /* ================= RENDER ================= */
  return (
    <>
      {/* ── Canvas ── */}
      <canvas ref={canvasRef} style={{ display: "block", cursor }} />

      {/* ── Toolbar ── */}
      <div className="toolbar">

        {/* Tools */}
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

        {/* Colors */}
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

        {/* Stroke widths */}
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
                width: w * 5,
                height: w,
                background: color,
                borderRadius: 2,
              }} />
            </button>
          ))}
        </div>

        <div className="divider" />

        {/* Toggles */}
        <div className="toolbar-group">
          <button
            className={`toggle-btn${showGrid ? " active" : ""}`}
            onClick={() => setShowGrid(v => !v)}
          >
            Grid
          </button>
          <button
            className={`toggle-btn${snap ? " active" : ""}`}
            onClick={() => setSnap(v => !v)}
          >
            Snap
          </button>
        </div>

        <div className="divider" />

        {/* Actions */}
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
        </div>
        <div className="statusbar-right">
          <span>{lineWidth}px</span>
          <span style={{
            display: "inline-block",
            width: 10, height: 10,
            borderRadius: "50%",
            background: color,
            border: "1px solid rgba(255,255,255,0.2)",
            verticalAlign: "middle",
          }} />
          <span>{showGrid ? "grid on" : "grid off"}</span>
          <span>{snap ? "snap on" : "snap off"}</span>
        </div>
      </div>
    </>
  );
}