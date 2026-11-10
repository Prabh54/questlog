import type {
  AuthResponse,
  LoginBody,
  RegisterBody,
  UpdateMeBody,
  User,
  UserResponse,
} from '@questlog/shared';
import { api } from '../lib/api';

// Wire types come from @questlog/shared — the same Zod schemas the API validates with.
export type AuthUser = User;
export type { AuthResponse };
export type RegisterPayload = RegisterBody;
export type LoginPayload = LoginBody;
export type UpdateMePayload = UpdateMeBody;

export const authApi = {
  register: (payload: RegisterPayload) =>
    api.post<AuthResponse>('/auth/register', payload),

  login: (payload: LoginPayload) =>
    api.post<AuthResponse>('/auth/login', payload),

  getMe: () => api.get<UserResponse>('/auth/me'),

  updateMe: (payload: UpdateMePayload) =>
    api.patch<UserResponse>('/auth/me', payload),

  /** Ends this device's session (revokes the refresh cookie). */
  logout: () => api.post<void>('/auth/logout'),

  /** Ends every session on every device. */
  logoutAll: () => api.post<void>('/auth/logout-all'),
};
