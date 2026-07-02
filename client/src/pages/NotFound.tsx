import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0F172A",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      fontFamily: "var(--font-ui, DM Sans, system-ui)",
    }}>
      <span style={{ fontSize: 56 }}>🗺</span>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F1F5F9", letterSpacing: "-0.02em" }}>
        Page not found
      </h1>
      <p style={{ fontSize: 14, color: "#64748B" }}>
        The page you're looking for doesn't exist.
      </p>
      <Link
        to="/dashboard"
        style={{
          marginTop: 8, padding: "9px 20px", borderRadius: 10,
          background: "rgba(37,99,235,0.20)", color: "#60A5FA",
          textDecoration: "none", fontSize: 13, fontWeight: 500,
        }}
      >
        Back to dashboard
      </Link>
    </div>
  );
}
