import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { boardsApi } from "../services/api";
import type { Board } from "../types/board";

// The actual canvas component — still App.tsx for now.
// In Phase 2 (Infinite Canvas) we'll extract Canvas.tsx.
import CanvasApp from "../App";

export default function Whiteboard() {
  const { boardId }   = useParams<{ boardId: string }>();
  const { logout }    = useAuth();
  const navigate      = useNavigate();

  const [board,   setBoard]   = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!boardId) { navigate("/dashboard"); return; }
    boardsApi.get(boardId)
      .then(b => { setBoard(b); setLoading(false); })
      .catch(err => {
        setError(err instanceof Error ? err.message : "Board not found.");
        setLoading(false);
      });
  }, [boardId, navigate]);

  if (loading) return null;

  if (error) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0F172A",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 12, fontFamily: "var(--font-ui, DM Sans, system-ui)",
      }}>
        <span style={{ fontSize: 36 }}>⚠</span>
        <p style={{ fontSize: 14, color: "#F87171" }}>{error}</p>
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: "rgba(37,99,235,0.20)", color: "#60A5FA",
            cursor: "pointer", fontSize: 13,
          }}
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      {/* Back button overlay — sits above the canvas */}
      <div style={{
        position: "fixed",
        top: 14,
        left: 14,
        zIndex: 1001,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <button
          onClick={() => navigate("/dashboard")}
          style={navBtnStyle}
          title="Back to dashboard"
        >
          ← {board?.name ?? "Board"}
        </button>
      </div>

      {/* Logout shortcut */}
      <div style={{ position: "fixed", top: 14, right: 14, zIndex: 1001 }}>
        <button onClick={logout} style={navBtnStyle} title="Sign out">
          Sign out
        </button>
      </div>

      {/* Canvas — full screen */}
      <CanvasApp />
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(30,41,59,0.90)",
  color: "#94A3B8",
  fontFamily: "var(--font-ui, DM Sans, system-ui)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  backdropFilter: "blur(8px)",
};
