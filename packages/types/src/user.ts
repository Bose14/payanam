export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  /** Set for phone sign-in accounts, e.g. +919876543210. */
  phone?: string;
  city?: string;
  bike?: string;
  /** False until a phone user finishes the profile, consent and permissions steps. */
  onboardingComplete?: boolean;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  fullName: string;
}

export interface UpdateUserRequest {
  fullName?: string;
  avatarUrl?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
