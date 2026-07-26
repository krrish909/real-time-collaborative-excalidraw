/**
 * CollaboratorCursors
 *
 * Renders remote user cursors as a fixed DOM overlay above the canvas.
 * Entirely client-side — no backend cursor messages exist yet.
 * When the backend adds cursor support, just populate the `cursors` prop
 * from useCollaboration and this component renders them automatically.
 */

import type { CollaboratorCursor } from "../types/operation";
import type { Viewport } from "../hooks/useViewport";
import { worldToScreen } from "../hooks/useViewport";

const CURSOR_COLORS = [
  "#F59E0B", "#10B981", "#F87171", "#C084FC",
  "#38BDF8", "#FB923C", "#A3E635", "#F472B6",
];

function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

interface Props {
  cursors:  CollaboratorCursor[];
  viewport: Viewport;
}

export default function CollaboratorCursors({ cursors, viewport }: Props) {
  if (cursors.length === 0) return null;

  return (
    <div style={{
      position: "fixed", inset: 0,
      pointerEvents: "none", zIndex: 500, overflow: "hidden",
    }}>
      {cursors.map(c => {
        const screen = worldToScreen({ x: c.x, y: c.y }, viewport);
        const color  = colorForUser(c.userId);

        return (
          <div
            key={c.userId}
            style={{
              position:  "absolute",
              left:       screen.x,
              top:        screen.y,
              transform:  "translate(-2px, -2px)",
              // CSS transition gives smooth interpolation between position updates
              transition: "left 60ms linear, top 60ms linear",
              pointerEvents: "none",
            }}
          >
            <svg width="18" height="22" viewBox="0 0 18 22"
              style={{ display: "block", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}
            >
              <path
                d="M0 0 L0 16 L4.5 12.5 L7.5 20 L10 19 L7 12 L12 12 Z"
                fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth="1"
              />
            </svg>
            <div style={{
              position: "absolute", top: 18, left: 10,
              padding: "2px 7px", borderRadius: 6,
              background: color, color: "#000",
              fontSize: 11, fontFamily: "var(--font-ui, DM Sans, system-ui)",
              fontWeight: 600, whiteSpace: "nowrap", letterSpacing: "0.01em",
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            }}>
              {c.userName}
            </div>
          </div>
        );
      })}
    </div>
  );
}
