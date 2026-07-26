import type { AuthResponse, LoginRequest, SignupRequest } from "../types/auth";
import type { Board, CreateBoardRequest, UpdateBoardRequest } from "../types/board";

// ── Base URL ──────────────────────────────────────────────────────────────────
// Set VITE_API_URL in your .env  (e.g. http://localhost:3001)
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4003";

// ── Token helpers ─────────────────────────────────────────────────────────────
export const TOKEN_KEY = "wb_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Decode a JWT payload without verifying (server will verify on every call). */
export function decodeTokenPayload<T>(token: string): T | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload)) as T;
  } catch {
    return null;
  }
}

/** Returns true when a JWT is present and not expired. */
export function isTokenValid(token: string): boolean {
  const payload = decodeTokenPayload<{ exp: number }>(token);
  if (!payload) return false;
  return payload.exp * 1000 > Date.now();
}

// ── Fetch wrapper ─────────────────────────────────────────────────────────────
interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const err = (await res.json()) as { message?: string };
      if (err.message) message = err.message;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ── Auth API ──────────────────────────────────────────────────────────────────
export const authApi = {
  login(data: LoginRequest): Promise<AuthResponse> {
    return request<AuthResponse>("/auth/login", { method: "POST", body: data, auth: false });
  },

  signup(data: SignupRequest): Promise<AuthResponse> {
    return request<AuthResponse>("/auth/signup", { method: "POST", body: data, auth: false });
  },

  /** Verify the stored JWT and return the current user. */
  me(): Promise<{ user: AuthResponse["user"] }> {
    return request<{ user: AuthResponse["user"] }>("/auth/me");
  },
};

// ── Boards API ────────────────────────────────────────────────────────────────
export const boardsApi = {
  list(): Promise<Board[]> {
    return request<Board[]>("/boards");
  },

  create(data: CreateBoardRequest): Promise<Board> {
    return request<Board>("/boards", { method: "POST", body: data });
  },

  update(id: string, data: UpdateBoardRequest): Promise<Board> {
    return request<Board>(`/boards/${id}`, { method: "PATCH", body: data });
  },

  delete(id: string): Promise<void> {
    return request<void>(`/boards/${id}`, { method: "DELETE" });
  },

  get(id: string): Promise<Board> {
    return request<Board>(`/boards/${id}`);
  },
};
