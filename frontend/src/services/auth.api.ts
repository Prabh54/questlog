import { api } from '../lib/api';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: string;
  xp: number;
  level: number;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface RegisterPayload {
  display_name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdateMePayload {
  display_name?: string;
  timezone?: string;
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    api.post<AuthResponse>('/auth/register', payload),

  login: (payload: LoginPayload) =>
    api.post<AuthResponse>('/auth/login', payload),

  getMe: () => api.get<{ user: AuthUser }>('/auth/me'),

  updateMe: (payload: UpdateMePayload) =>
    api.patch<{ user: AuthUser }>('/auth/me', payload),

  logout: () => api.post<void>('/auth/logout'),
};
