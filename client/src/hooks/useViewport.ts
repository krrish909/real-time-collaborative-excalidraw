import { useCallback, useRef, useState } from "react";
import type { Point } from "../types/shape";

export interface Viewport {
  x: number;     // pan offset x (screen pixels)
  y: number;     // pan offset y (screen pixels)
  scale: number; // zoom level (1 = 100%)
}

export const VIEWPORT_DEFAULTS: Viewport = { x: 0, y: 0, scale: 1 };
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 20;

/** Convert a screen-space point to world-space. */
export function screenToWorld(p: Point, vp: Viewport): Point {
  return {
    x: (p.x - vp.x) / vp.scale,
    y: (p.y - vp.y) / vp.scale,
  };
}

/** Convert a world-space point to screen-space. */
export function worldToScreen(p: Point, vp: Viewport): Point {
  return {
    x: p.x * vp.scale + vp.x,
    y: p.y * vp.scale + vp.y,
  };
}

/** Clamp scale within allowed range. */
function clampScale(s: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

/** Zoom toward a focal point (screen coords), keeping that point fixed. */
export function zoomToward(vp: Viewport, focalScreen: Point, delta: number): Viewport {
  const newScale = clampScale(vp.scale * (1 - delta * 0.001));
  const ratio    = newScale / vp.scale;
  return {
    scale: newScale,
    x: focalScreen.x - (focalScreen.x - vp.x) * ratio,
    y: focalScreen.y - (focalScreen.y - vp.y) * ratio,
  };
}

interface UseViewportReturn {
  viewport: Viewport;
  viewportRef: React.MutableRefObject<Viewport>;
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
  /** Mutates the ref AND queues a React state update (for re-render). */
  updateViewport: (next: Viewport) => void;
  isPanning: React.MutableRefObject<boolean>;
  panStart: React.MutableRefObject<Point | null>;
  isSpaceDown: React.MutableRefObject<boolean>;
}

export function useViewport(): UseViewportReturn {
  const [viewport, setViewport]   = useState<Viewport>(VIEWPORT_DEFAULTS);
  const viewportRef               = useRef<Viewport>(VIEWPORT_DEFAULTS);
  const isPanning                 = useRef(false);
  const panStart                  = useRef<Point | null>(null);
  const isSpaceDown               = useRef(false);

  const updateViewport = useCallback((next: Viewport) => {
    viewportRef.current = next;
    setViewport(next);
  }, []);

  return { viewport, viewportRef, setViewport, updateViewport, isPanning, panStart, isSpaceDown };
}
