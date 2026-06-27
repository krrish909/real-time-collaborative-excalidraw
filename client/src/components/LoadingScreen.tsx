export default function LoadingScreen() {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#0F172A",
      gap: 16,
    }}>
      {/* Animated logo mark */}
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: "linear-gradient(135deg, #2563EB, #7C3AED)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22,
        animation: "wb-pulse 1.4s ease-in-out infinite",
      }}>
        ✦
      </div>
      <p style={{
        fontFamily: "var(--font-ui, DM Sans, system-ui)",
        fontSize: 13,
        color: "rgba(148,163,184,0.7)",
        letterSpacing: "0.06em",
      }}>
        Loading…
      </p>
      <style>{`
        @keyframes wb-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.92); }
        }
      `}</style>
    </div>
  );
}
