export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  name: string;
  iat: number;
  exp: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  message: string;
  statusCode?: number;
}
