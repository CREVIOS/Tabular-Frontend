// types/auth.ts - Authentication related types

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  user_id?: string;
  user?: {
    id?: string;
    email?: string;
    name?: string;
    avatar_url?: string;
  };
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
  success: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: ApiError | null;
} 