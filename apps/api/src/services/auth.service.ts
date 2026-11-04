import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User, AuthResponse } from '@payanam/types';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { getDatabase } from '../config/database';
import env from '../config/environment';
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors';

export async function registerUser(
  email: string,
  password: string,
  fullName: string,
): Promise<AuthResponse> {
  const db = getDatabase();
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = fullName.trim();

  const { data: existingUser } = await db
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingUser) {
    throw new ConflictError('Email already registered');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const { data: newUser, error } = await db
    .from('users')
    .insert({
      email: normalizedEmail,
      password_hash: hashedPassword,
      full_name: trimmedName,
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
  const normalizedEmail = email.trim().toLowerCase();

  const { data: user, error } = await db
    .from('users')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();

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

export async function requestPasswordReset(email: string): Promise<{
  message: string;
  resetToken?: string;
  resetLink?: string;
}> {
  const db = getDatabase();
  const normalizedEmail = email.trim().toLowerCase();

  const { data: user, error } = await db
    .from('users')
    .select('id, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  // For privacy, return generic response even if user not found
  if (error || !user) {
    return {
      message: 'If an account exists with this email, a password reset link has been generated.',
    };
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  const { error: updateError } = await db
    .from('users')
    .update({
      reset_password_token: resetToken,
      reset_password_expires_at: expiresAt,
    })
    .eq('id', user.id);

  if (updateError) {
    throw new Error(`Failed to generate reset link: ${updateError.message}`);
  }

  const frontendUrl = env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

  console.log(`\n========================================`);
  console.log(`🔐 Password Reset Link for ${user.email}:`);
  console.log(`🔗 ${resetLink}`);
  console.log(`========================================\n`);

  return {
    message: 'If an account exists with this email, a password reset link has been generated.',
    resetToken,
    resetLink,
  };
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const db = getDatabase();

  const { data: user, error } = await db
    .from('users')
    .select('id, reset_password_expires_at')
    .eq('reset_password_token', token)
    .maybeSingle();

  if (error || !user) {
    throw new ValidationError('Invalid or expired password reset link');
  }

  if (user.reset_password_expires_at && new Date(user.reset_password_expires_at) < new Date()) {
    throw new ValidationError('Password reset link has expired. Please request a new one.');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const { error: updateError } = await db
    .from('users')
    .update({
      password_hash: hashedPassword,
      reset_password_token: null,
      reset_password_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (updateError) {
    throw new Error(`Failed to reset password: ${updateError.message}`);
  }

  return {
    message: 'Your password has been reset successfully. You can now log in with your new password.',
  };
}
