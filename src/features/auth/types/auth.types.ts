export type UserRole =
  | "super_admin"
  | "admin"
  | "treasurer"
  | "volunteer";

export interface AuthUser {
  id: string;
  fullName: string;
  mobile: string;
  role: UserRole;
  isActive: boolean;
}

export interface LoginRequest {
  mobile: string;
  pin: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
}