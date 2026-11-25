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

  if (error) {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('fetch failed') || msg.includes('failed to fetch') || msg.includes('enotfound') || msg.includes('econnrefused')) {
      throw new Error(
        'Database connection failed: Your Supabase database is paused. Please visit https://supabase.com/dashboard to restore/unpause your project.'
      );
    }
    throw new Error(`Database error: ${error.message || 'Unable to query user account'}`);
  }

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.password_hash) {
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
    email: user.email ?? '',
    phone: user.phone ?? undefined,
    fullName: user.full_name ?? '',
    avatarUrl: user.avatar_url,
    city: user.city ?? undefined,
    bike: user.bike ?? undefined,
    onboardingComplete: !!user.onboarding_completed_at || !user.phone,
    status: user.status,
    createdAt: new Date(user.created_at),
    updatedAt: new Date(user.updated_at),
  };
}

function parseUtcDate(val: string | Date | null | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  let str = String(val).trim().replace(' ', 'T');
  // If no timezone offset (Z or +/-HH:MM) is present, explicitly treat as UTC
  if (!str.endsWith('Z') && !/[+-]\d{2}(?::?\d{2})?$/.test(str)) {
    str += 'Z';
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date(val) : parsed;
}

export async function requestPasswordReset(email: string): Promise<{
  message: string;
  resetToken?: string;
  resetLink?: string;
  email?: string;
}> {
  const db = getDatabase();
  const normalizedEmail = email.trim().toLowerCase();

  const { data: user, error } = await db
    .from('users')
    .select('id, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    console.error('❌ Database error finding user for reset:', error);
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('fetch failed') || msg.includes('failed to fetch') || msg.includes('enotfound') || msg.includes('econnrefused')) {
      throw new Error(
        'Database connection failed: Your Supabase database is currently paused. Please log into https://supabase.com/dashboard and click "Restore" to unpause your project.'
      );
    }
    throw new Error(`Database error: ${error.message || 'Unable to query user account'}`);
  }

  if (!user) {
    throw new NotFoundError(
      `No account registered with ${normalizedEmail}. Please check for typos or create a new account.`
    );
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours validity

  const { error: updateError } = await db
    .from('users')
    .update({
      reset_password_token: resetToken,
      reset_password_expires_at: expiresAt,
    })
    .eq('id', user.id);

  if (updateError) {
    console.error('❌ Database error updating reset_password_token:', updateError);
    if (updateError.message?.includes('reset_password_token') || updateError.message?.includes('schema cache')) {
      throw new Error(
        'Database is missing the reset_password_token column. Please run docs/PASSWORD_RESET_SETUP.sql in Supabase SQL editor.'
      );
    }
    throw new Error(`Failed to generate reset link: ${updateError.message}`);
  }

  const frontendUrl = env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

  console.log(`\n========================================`);
  console.log(`🔐 Password Reset Link for ${user.email}:`);
  console.log(`🔗 ${resetLink}`);
  console.log(`========================================\n`);

  return {
    message: 'Password reset link ready.',
    resetToken,
    resetLink,
    email: user.email,
  };
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const db = getDatabase();

  const { data: user, error } = await db
    .from('users')
    .select('id, reset_password_expires_at')
    .eq('reset_password_token', token)
    .maybeSingle();

  if (error) {
    console.error('❌ Database error reading reset token:', error);
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('fetch failed') || msg.includes('failed to fetch') || msg.includes('enotfound') || msg.includes('econnrefused')) {
      throw new Error(
        'Database connection failed: Your Supabase database is currently paused. Please log into https://supabase.com/dashboard and click "Restore" to unpause your project.'
      );
    }
    throw new Error(`Database error: ${error.message}`);
  }

  if (!user) {
    throw new ValidationError('Invalid or expired password reset link');
  }

  if (user.reset_password_expires_at) {
    const expiryDate = parseUtcDate(user.reset_password_expires_at);
    if (expiryDate && expiryDate.getTime() < Date.now()) {
      throw new ValidationError('Password reset link has expired. Please request a new one.');
    }
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

/** Everything we hold about the signed-in user, for the "Download my data" action. */
export async function exportUserData(userId: string) {
  const db = getDatabase();
  const [{ data: user }, { data: riderProfile }, { data: trips }, { data: memberships }] = await Promise.all([
    db.from('users').select('*').eq('id', userId).maybeSingle(),
    db.from('rider_profiles').select('*').eq('user_id', userId).maybeSingle(),
    db.from('trips').select('*').eq('created_by', userId),
    db.from('room_members').select('*').eq('user_id', userId),
  ]);
  if (!user) throw new NotFoundError('User');

  // Never hand back credential material.
  const safeUser = { ...user };
  delete (safeUser as Record<string, unknown>).password_hash;
  delete (safeUser as Record<string, unknown>).reset_password_token;
  delete (safeUser as Record<string, unknown>).reset_password_expires_at;
  return {
    exportedAt: new Date().toISOString(),
    user: safeUser,
    riderProfile: riderProfile ?? null,
    tripsYouLead: trips ?? [],
    tripMemberships: memberships ?? [],
  };
}

/**
 * Anonymises the account rather than deleting the row: trips and ride history
 * that other riders rely on keep their foreign keys, but nothing identifies this person.
 */
export async function deleteUserAccount(userId: string): Promise<{ message: string }> {
  const db = getDatabase();
  const { data: user } = await db.from('users').select('phone').eq('id', userId).maybeSingle();
  if (!user) throw new NotFoundError('User');

  await db.from('rider_profiles').delete().eq('user_id', userId);
  await db.from('sessions').delete().eq('user_id', userId);
  if (user.phone) await db.from('phone_otps').delete().eq('phone', user.phone);

  const { error } = await db
    .from('users')
    .update({
      full_name: 'Deleted rider',
      email: null,
      phone: null,
      password_hash: null,
      avatar_url: null,
      city: null,
      bike: null,
      reset_password_token: null,
      reset_password_expires_at: null,
      status: 'inactive',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) throw new Error(`Failed to delete account: ${error.message}`);
  return { message: 'Account deleted' };
}
