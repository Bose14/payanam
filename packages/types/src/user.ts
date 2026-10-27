export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
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
