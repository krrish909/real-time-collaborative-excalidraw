import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  authApi,
  decodeTokenPayload,
  getToken,
  isTokenValid,
  removeToken,
  setToken,
} from "../services/api";
import type { AuthTokenPayload, LoginRequest, SignupRequest, User } from "../types/auth";

// ── Shape ────────────────────────────────────────────────────────────────────
interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  signup: (data: SignupRequest) => Promise<void>;
  logout: () => void;
}

// ── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading]  = useState(true);

  // Timer ref for auto-logout when token expires
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  };

  const logout = useCallback(() => {
    clearTimer();
    removeToken();
    setTokenState(null);
    setUser(null);
  }, []);

  /** Schedules auto-logout at exact token expiry. */
  const scheduleAutoLogout = useCallback(
    (tok: string) => {
      clearTimer();
      const payload = decodeTokenPayload<AuthTokenPayload>(tok);
      if (!payload) return;
      const msUntilExpiry = payload.exp * 1000 - Date.now();
      if (msUntilExpiry <= 0) {
        logout();
        return;
      }
      logoutTimerRef.current = setTimeout(logout, msUntilExpiry);
    },
    [logout],
  );

  const applyAuth = useCallback(
    (tok: string, u: User) => {
      setToken(tok);
      setTokenState(tok);
      setUser(u);
      scheduleAutoLogout(tok);
    },
    [scheduleAutoLogout],
  );

  // ── Boot: try to restore session from localStorage ──────────────────────
  useEffect(() => {
    async function restore() {
      const stored = getToken();
      if (!stored || !isTokenValid(stored)) {
        removeToken();
        setLoading(false);
        return;
      }
      try {
        // Re-validate with backend — handles revoked tokens
        const { user: u } = await authApi.me();
        applyAuth(stored, u);
      } catch {
        removeToken();
      } finally {
        setLoading(false);
      }
    }
    restore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auth actions ──────────────────────────────────────────────────────────
  const login = useCallback(
    async (data: LoginRequest) => {
      const { token: tok, user: u } = await authApi.login(data);
      applyAuth(tok, u);
    },
    [applyAuth],
  );

  const signup = useCallback(
    async (data: SignupRequest) => {
      await authApi.signup(data);
      // Don't auto-login after signup — redirect to login page instead
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: !!user,
      login,
      signup,
      logout,
    }),
    [user, token, loading, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
