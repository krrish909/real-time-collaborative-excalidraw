import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { boardsApi } from "../services/api";
import type { Board } from "../types/board";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();

  const [boards,   setBoards]   = useState<Board[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [creating, setCreating] = useState(false);
  const [search,   setSearch]   = useState("");
  const [error,    setError]    = useState<string | null>(null);

  // Inline rename state
  const [renamingId,  setRenamingId]  = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  const fetchBoards = useCallback(async () => {
    try {
      const data = await boardsApi.list();
      setBoards(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load boards.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBoards(); }, [fetchBoards]);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  async function handleCreate() {
    setCreating(true);
    try {
      const board = await boardsApi.create({ name: "Untitled board" });
      navigate(`/board/${board.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create board.");
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this board? This cannot be undone.")) return;
    try {
      await boardsApi.delete(id);
      setBoards(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete board.");
    }
  }

  async function handleRename(id: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenamingId(null); return; }
    try {
      const updated = await boardsApi.update(id, { name: trimmed });
      setBoards(prev => prev.map(b => b.id === id ? updated : b));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename board.");
    } finally {
      setRenamingId(null);
    }
  }

  const filtered = boards.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  const recent   = [...boards]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4);

  const initials = (user?.name ?? "?")
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div style={s.root}>
      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        <div style={s.sidebarLogo}>
          <div style={s.logoMark}>✦</div>
          <span style={s.logoText}>Whiteboard</span>
        </div>

        <nav style={s.nav}>
          <div style={{ ...s.navItem, ...s.navItemActive }}>
            <span>🏠</span> Home
          </div>
          <div style={s.navItem}><span>⭐</span> Starred</div>
          <div style={s.navItem}><span>🕑</span> Recent</div>
        </nav>

        <div style={s.sidebarFooter}>
          <div style={s.avatar}>{initials}</div>
          <div style={s.userInfo}>
            <span style={s.userName}>{user?.name}</span>
            <span style={s.userEmail}>{user?.email}</span>
          </div>
          <button style={s.logoutBtn} onClick={logout} title="Sign out">
            ⏏
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={s.main}>
        {/* Header */}
        <header style={s.header}>
          <div>
            <h1 style={s.greeting}>Good {timeOfDay()}, {user?.name?.split(" ")[0]} 👋</h1>
            <p style={s.headerSub}>
              {boards.length === 0
                ? "Create your first board to get started."
                : `You have ${boards.length} board${boards.length !== 1 ? "s" : ""}.`}
            </p>
          </div>
          <button
            style={{ ...s.createBtn, ...(creating ? s.createBtnLoading : {}) }}
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? "…" : "+ New board"}
          </button>
        </header>

        {error && (
          <div style={s.errorBanner} role="alert">
            ⚠ {error}
            <button style={s.errorClose} onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Search */}
        <div style={s.searchWrap}>
          <span style={s.searchIcon}>🔍</span>
          <input
            type="search"
            placeholder="Search boards…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={s.searchInput}
          />
        </div>

        {/* Recent strip */}
        {!search && recent.length > 0 && (
          <section style={s.section}>
            <h2 style={s.sectionTitle}>Recent</h2>
            <div style={s.recentGrid}>
              {recent.map(b => (
                <BoardCard
                  key={b.id}
                  board={b}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  renameInputRef={renameInputRef}
                  onOpen={() => navigate(`/board/${b.id}`)}
                  onStartRename={() => { setRenamingId(b.id); setRenameValue(b.name); }}
                  onRenameChange={setRenameValue}
                  onRenameCommit={() => handleRename(b.id)}
                  onDelete={() => handleDelete(b.id)}
                  variant="compact"
                />
              ))}
            </div>
          </section>
        )}

        {/* All boards */}
        <section style={s.section}>
          <h2 style={s.sectionTitle}>
            {search ? `Results for "${search}"` : "All boards"}
          </h2>

          {loading ? (
            <div style={s.emptyState}>
              <span style={s.emptyIcon}>⟳</span>
              <p style={s.emptyText}>Loading boards…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={s.emptyState}>
              <span style={s.emptyIcon}>{search ? "🔍" : "📋"}</span>
              <p style={s.emptyText}>
                {search ? "No boards match your search." : "No boards yet. Create one to get started."}
              </p>
              {!search && (
                <button style={s.emptyBtn} onClick={handleCreate}>
                  Create board
                </button>
              )}
            </div>
          ) : (
            <div style={s.boardGrid}>
              {filtered.map(b => (
                <BoardCard
                  key={b.id}
                  board={b}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  renameInputRef={renameInputRef}
                  onOpen={() => navigate(`/board/${b.id}`)}
                  onStartRename={() => { setRenamingId(b.id); setRenameValue(b.name); }}
                  onRenameChange={setRenameValue}
                  onRenameCommit={() => handleRename(b.id)}
                  onDelete={() => handleDelete(b.id)}
                  variant="full"
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// ── Board card ────────────────────────────────────────────────────────────────
interface CardProps {
  board: Board;
  renamingId: string | null;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onOpen: () => void;
  onStartRename: () => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onDelete: () => void;
  variant: "compact" | "full";
}

function BoardCard({
  board, renamingId, renameValue, renameInputRef,
  onOpen, onStartRename, onRenameChange, onRenameCommit, onDelete,
  variant,
}: CardProps) {
  const isRenaming = renamingId === board.id;
  const isCompact  = variant === "compact";

  return (
    <div
      style={{
        ...s.card,
        ...(isCompact ? s.cardCompact : {}),
      }}
    >
      {/* Preview */}
      <div style={{ ...s.cardPreview, ...(isCompact ? s.cardPreviewCompact : {}) }}
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === "Enter" && onOpen()}
      >
        <span style={s.cardIcon}>📋</span>
      </div>

      {/* Footer */}
      <div style={s.cardFooter}>
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={e => onRenameChange(e.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={e => {
              if (e.key === "Enter")  onRenameCommit();
              if (e.key === "Escape") { /* cancel */ (renameInputRef as React.MutableRefObject<HTMLInputElement | null>).current = null; }
            }}
            style={s.renameInput}
          />
        ) : (
          <span style={s.cardName}>{board.name}</span>
        )}

        <div style={s.cardMeta}>
          <span style={s.cardDate}>{formatDate(board.updatedAt)}</span>
          <div style={s.cardActions}>
            <button style={s.iconBtn} onClick={onStartRename} title="Rename">✏️</button>
            <button style={{ ...s.iconBtn, ...s.iconBtnDanger }} onClick={onDelete} title="Delete">🗑</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  root: { display: "flex", height: "100vh", background: "#0B1120", overflow: "hidden" },
  sidebar: {
    width: 220, flexShrink: 0,
    background: "rgba(15,23,42,0.95)",
    borderRight: "1px solid rgba(255,255,255,0.06)",
    display: "flex", flexDirection: "column",
    padding: "20px 0",
  },
  sidebarLogo: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "0 20px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  logoMark: {
    width: 32, height: 32, borderRadius: 9,
    background: "linear-gradient(135deg, #2563EB, #7C3AED)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, color: "#fff",
  },
  logoText: { fontFamily: "var(--font-ui,DM Sans,system-ui)", fontWeight: 600, fontSize: 15, color: "#F1F5F9" },
  nav: { flex: 1, padding: "16px 10px", display: "flex", flexDirection: "column", gap: 2 },
  navItem: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 12px", borderRadius: 8,
    fontFamily: "var(--font-ui,DM Sans,system-ui)", fontSize: 13, fontWeight: 500,
    color: "#64748B", cursor: "pointer", transition: "background 120ms, color 120ms",
  },
  navItemActive: { background: "rgba(37,99,235,0.15)", color: "#60A5FA" },
  sidebarFooter: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "16px 20px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  avatar: {
    width: 32, height: 32, borderRadius: "50%",
    background: "linear-gradient(135deg, #2563EB, #7C3AED)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0,
  },
  userInfo: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 },
  userName: { fontSize: 12, fontWeight: 600, color: "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  userEmail: { fontSize: 11, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  logoutBtn: {
    background: "transparent", border: "none", cursor: "pointer",
    fontSize: 16, color: "#475569", padding: 4, flexShrink: 0,
    transition: "color 150ms",
  },
  main: { flex: 1, overflow: "auto", padding: "40px 48px" },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 },
  greeting: { fontFamily: "var(--font-ui,DM Sans,system-ui)", fontSize: 26, fontWeight: 700, color: "#F1F5F9", letterSpacing: "-0.02em", marginBottom: 4 },
  headerSub: { fontFamily: "var(--font-ui,DM Sans,system-ui)", fontSize: 14, color: "#64748B" },
  createBtn: {
    padding: "10px 20px", borderRadius: 10, border: "none",
    background: "linear-gradient(135deg, #2563EB, #7C3AED)", color: "#fff",
    fontFamily: "var(--font-ui,DM Sans,system-ui)", fontSize: 13, fontWeight: 600,
    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
  },
  createBtnLoading: { opacity: 0.6, cursor: "wait" },
  errorBanner: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 16px", borderRadius: 10, marginBottom: 20,
    background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)",
    color: "#FCA5A5", fontSize: 13, fontFamily: "var(--font-ui,DM Sans,system-ui)",
  },
  errorClose: { background: "transparent", border: "none", color: "#FCA5A5", cursor: "pointer", fontSize: 14 },
  searchWrap: {
    position: "relative", marginBottom: 36,
  },
  searchIcon: { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" },
  searchInput: {
    width: "100%", maxWidth: 360, padding: "10px 14px 10px 40px",
    borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(30,41,59,0.70)", color: "#F1F5F9",
    fontFamily: "var(--font-ui,DM Sans,system-ui)", fontSize: 14, outline: "none",
    boxSizing: "border-box",
  },
  section: { marginBottom: 40 },
  sectionTitle: { fontFamily: "var(--font-ui,DM Sans,system-ui)", fontSize: 13, fontWeight: 600, color: "#475569", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16 },
  recentGrid: { display: "flex", gap: 16, flexWrap: "wrap" },
  boardGrid:  { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 },
  emptyState: { padding: "60px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  emptyIcon: { fontSize: 36, opacity: 0.4 },
  emptyText: { fontFamily: "var(--font-ui,DM Sans,system-ui)", fontSize: 14, color: "#475569" },
  emptyBtn: {
    marginTop: 4, padding: "9px 18px", borderRadius: 10, border: "none",
    background: "rgba(37,99,235,0.20)", color: "#60A5FA",
    fontFamily: "var(--font-ui,DM Sans,system-ui)", fontSize: 13, fontWeight: 500, cursor: "pointer",
  },
  card: {
    background: "rgba(30,41,59,0.8)", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14, overflow: "hidden",
    transition: "border-color 150ms, box-shadow 150ms",
  },
  cardCompact: { display: "flex", flexDirection: "row", width: 220 },
  cardPreview: {
    background: "rgba(15,23,42,0.60)", display: "flex", alignItems: "center",
    justifyContent: "center", cursor: "pointer", height: 120,
    transition: "background 150ms",
  },
  cardPreviewCompact: { width: 72, height: "auto", flexShrink: 0 },
  cardIcon: { fontSize: 28, opacity: 0.3 },
  cardFooter: { padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 },
  cardName: { fontFamily: "var(--font-ui,DM Sans,system-ui)", fontSize: 13, fontWeight: 600, color: "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  cardMeta: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  cardDate: { fontSize: 11, color: "#475569", fontFamily: "var(--font-mono,DM Mono,monospace)" },
  cardActions: { display: "flex", gap: 4 },
  iconBtn: { background: "transparent", border: "none", cursor: "pointer", fontSize: 13, padding: "2px 4px", opacity: 0.5, transition: "opacity 120ms" },
  iconBtnDanger: {},
  renameInput: {
    width: "100%", padding: "2px 6px", borderRadius: 6,
    border: "1px solid rgba(37,99,235,0.50)",
    background: "rgba(15,23,42,0.80)", color: "#F1F5F9",
    fontFamily: "var(--font-ui,DM Sans,system-ui)", fontSize: 13, outline: "none",
    boxSizing: "border-box",
  },
};
