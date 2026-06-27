import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8)            score++;
  if (pw.length >= 12)           score++;
  if (/[A-Z]/.test(pw))         score++;
  if (/[0-9]/.test(pw))         score++;
  if (/[^A-Za-z0-9]/.test(pw))  score++;

  if (score <= 1) return { score, label: "Weak",   color: "#EF4444" };
  if (score <= 2) return { score, label: "Fair",   color: "#F59E0B" };
  if (score <= 3) return { score, label: "Good",   color: "#3B82F6" };
  return              { score, label: "Strong", color: "#10B981" };
}

export default function Signup() {
  const { signup }  = useAuth();
  const navigate    = useNavigate();

  const [name,          setName]          = useState("");
  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [confirmPass,   setConfirmPass]   = useState("");
  const [showPass,      setShowPass]      = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [success,       setSuccess]       = useState(false);

  const emailValid    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passMatch     = password === confirmPass;
  const strength      = passwordStrength(password);
  const canSubmit     =
    name.trim().length >= 2 &&
    emailValid &&
    password.length >= 8 &&
    passMatch &&
    !loading;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await signup({ name: name.trim(), email: email.trim(), password });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={styles.root}>
        <div style={styles.gridBg} aria-hidden />
        <div style={{ ...styles.card, textAlign: "center", gap: 16, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 44 }}>🎉</div>
          <h1 style={styles.heading}>Account created!</h1>
          <p style={{ ...styles.sub, marginBottom: 0 }}>
            Redirecting you to login…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <div style={styles.gridBg} aria-hidden />

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoRow}>
          <div style={styles.logoMark}>✦</div>
          <span style={styles.logoText}>Whiteboard</span>
        </div>

        <h1 style={styles.heading}>Create your account</h1>
        <p style={styles.sub}>Start collaborating in seconds</p>

        {error && (
          <div style={styles.errorBanner} role="alert">
            <span>⚠</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={styles.form}>
          {/* Name */}
          <div style={styles.field}>
            <label htmlFor="name" style={styles.label}>Full name</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jane Smith"
              style={styles.input}
              disabled={loading}
            />
          </div>

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
            <label htmlFor="password" style={styles.label}>Password</label>
            <div style={styles.inputWrap}>
              <input
                id="password"
                type={showPass ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
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

            {/* Strength meter */}
            {password.length > 0 && (
              <div style={styles.strengthRow}>
                <div style={styles.strengthTrack}>
                  {[1,2,3,4,5].map(i => (
                    <div
                      key={i}
                      style={{
                        ...styles.strengthSegment,
                        background: i <= strength.score ? strength.color : "rgba(255,255,255,0.08)",
                        transition: "background 250ms",
                      }}
                    />
                  ))}
                </div>
                <span style={{ ...styles.strengthLabel, color: strength.color }}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div style={styles.field}>
            <label htmlFor="confirm" style={styles.label}>Confirm password</label>
            <input
              id="confirm"
              type={showPass ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)}
              placeholder="Repeat your password"
              style={{
                ...styles.input,
                ...(confirmPass && !passMatch ? styles.inputError : {}),
              }}
              disabled={loading}
            />
            {confirmPass && !passMatch && (
              <span style={styles.fieldError}>Passwords do not match</span>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              ...styles.submitBtn,
              ...(loading ? styles.submitBtnLoading : {}),
              ...(!canSubmit && !loading ? styles.submitBtnDisabled : {}),
            }}
          >
            {loading && <span style={styles.spinner} aria-hidden />}
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p style={styles.loginPrompt}>
          Already have an account?{" "}
          <Link to="/login" style={styles.link}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

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
  logoRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 28 },
  logoMark: {
    width: 36, height: 36, borderRadius: 10,
    background: "linear-gradient(135deg, #2563EB, #7C3AED)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 16, color: "#fff", flexShrink: 0,
  },
  logoText: {
    fontFamily: "var(--font-ui, DM Sans, system-ui)",
    fontWeight: 600, fontSize: 17, color: "#F1F5F9", letterSpacing: "-0.01em",
  },
  heading: {
    fontFamily: "var(--font-ui, DM Sans, system-ui)",
    fontSize: 24, fontWeight: 600, color: "#F1F5F9",
    letterSpacing: "-0.02em", marginBottom: 6,
  },
  sub: {
    fontFamily: "var(--font-ui, DM Sans, system-ui)",
    fontSize: 14, color: "#64748B", marginBottom: 28,
  },
  errorBanner: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "10px 14px", borderRadius: 10,
    background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)",
    color: "#FCA5A5", fontSize: 13,
    fontFamily: "var(--font-ui, DM Sans, system-ui)", marginBottom: 20,
  },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: {
    fontFamily: "var(--font-ui, DM Sans, system-ui)",
    fontSize: 13, fontWeight: 500, color: "#94A3B8", letterSpacing: "0.02em",
  },
  inputWrap: { position: "relative" },
  input: {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(15,23,42,0.60)", color: "#F1F5F9",
    fontFamily: "var(--font-ui, DM Sans, system-ui)", fontSize: 14,
    outline: "none", boxSizing: "border-box",
  },
  inputError:   { borderColor: "rgba(239,68,68,0.50)" },
  fieldError:   { fontSize: 12, color: "#F87171", fontFamily: "var(--font-ui, DM Sans, system-ui)" },
  eyeBtn: {
    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
    background: "transparent", border: "none", cursor: "pointer", fontSize: 15, padding: 2,
  },
  strengthRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 6 },
  strengthTrack: { display: "flex", gap: 4, flex: 1 },
  strengthSegment: { flex: 1, height: 3, borderRadius: 4 },
  strengthLabel: { fontSize: 11, fontFamily: "var(--font-ui, DM Sans, system-ui)", fontWeight: 600, width: 46, textAlign: "right" },
  submitBtn: {
    marginTop: 6, padding: "11px 0", borderRadius: 10, border: "none",
    background: "linear-gradient(135deg, #2563EB, #7C3AED)", color: "#fff",
    fontFamily: "var(--font-ui, DM Sans, system-ui)", fontSize: 14, fontWeight: 600,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    gap: 8, letterSpacing: "0.01em",
  },
  submitBtnDisabled: { opacity: 0.45, cursor: "not-allowed" },
  submitBtnLoading:  { opacity: 0.75, cursor: "wait" },
  spinner: {
    display: "inline-block", width: 14, height: 14,
    border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff",
    borderRadius: "50%", animation: "wb-spin 0.7s linear infinite",
  },
  loginPrompt: {
    textAlign: "center", fontSize: 13, color: "#64748B",
    fontFamily: "var(--font-ui, DM Sans, system-ui)", marginTop: 24,
  },
  link: { color: "#3B82F6", textDecoration: "none", fontWeight: 500 },
};
