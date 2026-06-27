import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface LocationState {
  from?: { pathname: string };
}

export default function Login() {
  const { login } = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  const from       = (location.state as LocationState)?.from?.pathname ?? "/dashboard";

  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const emailValid   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit    = emailValid && password.length >= 6 && !loading;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      {/* Background grid */}
      <div style={styles.gridBg} aria-hidden />

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoRow}>
          <div style={styles.logoMark}>✦</div>
          <span style={styles.logoText}>Whiteboard</span>
        </div>

        <h1 style={styles.heading}>Welcome back</h1>
        <p style={styles.sub}>Sign in to your workspace</p>

        {/* Error banner */}
        {error && (
          <div style={styles.errorBanner} role="alert">
            <span style={styles.errorIcon}>⚠</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={styles.form}>
          {/* Email */}
          <div style={styles.field}>
            <label htmlFor="email" style={styles.label}>Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              style={{
                ...styles.input,
                ...(email && !emailValid ? styles.inputError : {}),
              }}
              disabled={loading}
            />
            {email && !emailValid && (
              <span style={styles.fieldError}>Enter a valid email address</span>
            )}
          </div>

          {/* Password */}
          <div style={styles.field}>
            <div style={styles.labelRow}>
              <label htmlFor="password" style={styles.label}>Password</label>
              <button type="button" style={styles.forgotBtn}>
                Forgot password?
              </button>
            </div>
            <div style={styles.inputWrap}>
              <input
                id="password"
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={styles.input}
                disabled={loading}
              />
              <button
                type="button"
                style={styles.eyeBtn}
                onClick={() => setShowPass(v => !v)}
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              ...styles.submitBtn,
              ...(loading ? styles.submitBtnLoading : {}),
              ...(!canSubmit && !loading ? styles.submitBtnDisabled : {}),
            }}
          >
            {loading ? (
              <span style={styles.spinner} aria-hidden />
            ) : null}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Divider */}
        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>New here?</span>
          <span style={styles.dividerLine} />
        </div>

        <p style={styles.signupPrompt}>
          Don't have an account?{" "}
          <Link to="/signup" style={styles.link}>Create one free</Link>
        </p>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0F172A",
    padding: "24px 16px",
    position: "relative",
    overflow: "hidden",
  },
  gridBg: {
    position: "absolute",
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(37,99,235,0.07) 1px, transparent 1px),
      linear-gradient(90deg, rgba(37,99,235,0.07) 1px, transparent 1px)
    `,
    backgroundSize: "40px 40px",
    pointerEvents: "none",
  },
  card: {
    position: "relative",
    width: "100%",
    maxWidth: 400,
    background: "rgba(30,41,59,0.95)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: "40px 36px",
    backdropFilter: "blur(20px)",
    boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 28,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "linear-gradient(135deg, #2563EB, #7C3AED)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    color: "#fff",
    flexShrink: 0,
  },
  logoText: {
    fontFamily: "var(--font-ui, DM Sans, system-ui)",
    fontWeight: 600,
    fontSize: 17,
    color: "#F1F5F9",
    letterSpacing: "-0.01em",
  },
  heading: {
    fontFamily: "var(--font-ui, DM Sans, system-ui)",
    fontSize: 24,
    fontWeight: 600,
    color: "#F1F5F9",
    letterSpacing: "-0.02em",
    marginBottom: 6,
  },
  sub: {
    fontFamily: "var(--font-ui, DM Sans, system-ui)",
    fontSize: 14,
    color: "#64748B",
    marginBottom: 28,
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 10,
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.25)",
    color: "#FCA5A5",
    fontSize: 13,
    fontFamily: "var(--font-ui, DM Sans, system-ui)",
    marginBottom: 20,
  },
  errorIcon: { fontSize: 14, flexShrink: 0 },
  form: { display: "flex", flexDirection: "column", gap: 18 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: {
    fontFamily: "var(--font-ui, DM Sans, system-ui)",
    fontSize: 13,
    fontWeight: 500,
    color: "#94A3B8",
    letterSpacing: "0.02em",
  },
  labelRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputWrap: { position: "relative" },
  input: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(15,23,42,0.60)",
    color: "#F1F5F9",
    fontFamily: "var(--font-ui, DM Sans, system-ui)",
    fontSize: 14,
    outline: "none",
    transition: "border-color 150ms",
    boxSizing: "border-box",
  },
  inputError: {
    borderColor: "rgba(239,68,68,0.50)",
  },
  fieldError: {
    fontSize: 12,
    color: "#F87171",
    fontFamily: "var(--font-ui, DM Sans, system-ui)",
  },
  eyeBtn: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 15,
    lineHeight: 1,
    padding: 2,
  },
  forgotBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    color: "#3B82F6",
    fontFamily: "var(--font-ui, DM Sans, system-ui)",
    padding: 0,
  },
  submitBtn: {
    marginTop: 6,
    padding: "11px 0",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #2563EB, #7C3AED)",
    color: "#fff",
    fontFamily: "var(--font-ui, DM Sans, system-ui)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "opacity 150ms, transform 150ms",
    letterSpacing: "0.01em",
  },
  submitBtnDisabled: { opacity: 0.45, cursor: "not-allowed" },
  submitBtnLoading:  { opacity: 0.75, cursor: "wait" },
  spinner: {
    display: "inline-block",
    width: 14,
    height: 14,
    border: "2px solid rgba(255,255,255,0.35)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "wb-spin 0.7s linear infinite",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    margin: "24px 0 16px",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: "rgba(255,255,255,0.08)",
  },
  dividerText: {
    fontSize: 12,
    color: "#475569",
    fontFamily: "var(--font-ui, DM Sans, system-ui)",
    whiteSpace: "nowrap",
  },
  signupPrompt: {
    textAlign: "center",
    fontSize: 13,
    color: "#64748B",
    fontFamily: "var(--font-ui, DM Sans, system-ui)",
  },
  link: {
    color: "#3B82F6",
    textDecoration: "none",
    fontWeight: 500,
  },
};
