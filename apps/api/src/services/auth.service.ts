import bcrypt from 'bcrypt';
import { User, AuthResponse } from '@payanam/types';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { getDatabase } from '../config/database';
import { ConflictError, NotFoundError, UnauthorizedError } from '../utils/errors';

export async function registerUser(
  email: string,
  password: string,
  fullName: string,
): Promise<AuthResponse> {
  const db = getDatabase();

  const { data: existingUser } = await db
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existingUser) {
    throw new ConflictError('Email already registered');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const { data: newUser, error } = await db
    .from('users')
    .insert({
      email,
      password_hash: hashedPassword,
      full_name: fullName,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }

  const user: User = {
    id: newUser.id,
    email: newUser.email,
    fullName: newUser.full_name,
    avatarUrl: newUser.avatar_url,
    status: newUser.status,
    createdAt: new Date(newUser.created_at),
    updatedAt: new Date(newUser.updated_at),
  };

  const accessToken = generateAccessToken(user.id, user.email);
  const refreshToken = generateRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    user,
  };
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const db = getDatabase();

  const { data: user, error } = await db
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const userResponse: User = {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    avatarUrl: user.avatar_url,
    status: user.status,
    createdAt: new Date(user.created_at),
    updatedAt: new Date(user.updated_at),
    lastLoginAt: user.last_login_at ? new Date(user.last_login_at) : undefined,
  };

  await db
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  const accessToken = generateAccessToken(userResponse.id, userResponse.email);
  const refreshToken = generateRefreshToken(userResponse.id);

  return {
    accessToken,
    refreshToken,
    user: userResponse,
  };
}

export async function getUserById(userId: string): Promise<User> {
  const db = getDatabase();

  const { data: user, error } = await db
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new NotFoundError('User');
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    avatarUrl: user.avatar_url,
    status: user.status,
    createdAt: new Date(user.created_at),
    updatedAt: new Date(user.updated_at),
  };
}
