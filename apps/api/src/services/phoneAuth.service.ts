import crypto from 'crypto';
import { AuthResponse, User } from '@payanam/types';
import { getDatabase } from '../config/database';
import env from '../config/environment';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { AppError, UnauthorizedError, ValidationError } from '../utils/errors';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_GAP_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 6;

/** Returns +91XXXXXXXXXX, or null when the input is not a valid Indian mobile number. */
export function normalizeIndianPhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, '');
  const ten = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(ten)) return null;
  return `+91${ten}`;
}

function hashCode(phone: string, code: string): string {
  return crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`${phone}:${code}`)
    .digest('hex');
}

function otpDevMode(): boolean {
  if (env.OTP_DEV_MODE) return env.OTP_DEV_MODE === 'true';
  return env.NODE_ENV !== 'production';
}

async function sendSms(phone: string, code: string): Promise<void> {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM_NUMBER: from } = env;
  if (!sid || !token || !from) {
    // No SMS provider configured: only acceptable outside production.
    if (env.NODE_ENV === 'production') {
      throw new AppError(503, 'SMS_NOT_CONFIGURED', 'SMS sign-in is not available right now.');
    }
    console.log(`[phone-otp] SMS provider not configured. Code for ${phone}: ${code}`);
    return;
  }
  const body = new URLSearchParams({
    To: phone,
    From: from,
    Body: `Your Payanam code is ${code}. It expires in 10 minutes.`,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    console.error('[phone-otp] Twilio send failed', res.status);
    throw new AppError(502, 'SMS_SEND_FAILED', 'Could not send the code. Try again in a moment.');
  }
}

export async function requestPhoneCode(rawPhone: string): Promise<{ sent: true; devCode?: string }> {
  const phone = normalizeIndianPhone(rawPhone);
  if (!phone) throw new ValidationError('Enter a valid 10-digit mobile number');

  const db = getDatabase();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent, error: recentErr } = await db
    .from('phone_otps')
    .select('created_at')
    .eq('phone', phone)
    .gte('created_at', hourAgo)
    .order('created_at', { ascending: false });
  if (recentErr) throw new Error(`Failed to check recent codes: ${recentErr.message}`);

  if (recent && recent.length >= MAX_CODES_PER_HOUR) {
    throw new AppError(429, 'TOO_MANY_REQUESTS', 'Too many codes requested. Try again in an hour.');
  }
  if (recent && recent.length > 0) {
    const last = new Date(recent[0].created_at).getTime();
    if (Date.now() - last < RESEND_GAP_MS) {
      throw new AppError(429, 'TOO_MANY_REQUESTS', 'Wait a few seconds before asking for another code.');
    }
  }

  const code = String(crypto.randomInt(0, 10000)).padStart(4, '0');
  const { error } = await db.from('phone_otps').insert({
    phone,
    code_hash: hashCode(phone, code),
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });
  if (error) throw new Error(`Failed to store code: ${error.message}`);

  await sendSms(phone, code);
  return otpDevMode() ? { sent: true, devCode: code } : { sent: true };
}

interface UserRow {
  id: string;
  email?: string | null;
  phone?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  city?: string | null;
  bike?: string | null;
  onboarding_completed_at?: string | null;
  status: User['status'];
  created_at: string;
  updated_at: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email ?? '',
    phone: row.phone ?? undefined,
    fullName: row.full_name ?? '',
    avatarUrl: row.avatar_url ?? undefined,
    city: row.city ?? undefined,
    bike: row.bike ?? undefined,
    onboardingComplete: !!row.onboarding_completed_at,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function verifyPhoneCode(
  rawPhone: string,
  code: string,
): Promise<AuthResponse & { isNewUser: boolean }> {
  const phone = normalizeIndianPhone(rawPhone);
  if (!phone) throw new ValidationError('Enter a valid 10-digit mobile number');
  if (!/^\d{4}$/.test(code)) throw new ValidationError('Enter the 4-digit code');

  const db = getDatabase();
  const { data: otp, error } = await db
    .from('phone_otps')
    .select('*')
    .eq('phone', phone)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to read code: ${error.message}`);

  if (!otp || new Date(otp.expires_at).getTime() < Date.now()) {
    throw new UnauthorizedError('That code has expired. Ask for a new one.');
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    throw new UnauthorizedError('Too many wrong tries. Ask for a new code.');
  }

  const expected = Buffer.from(otp.code_hash, 'hex');
  const given = Buffer.from(hashCode(phone, code), 'hex');
  const ok = expected.length === given.length && crypto.timingSafeEqual(expected, given);
  if (!ok) {
    await db.from('phone_otps').update({ attempts: otp.attempts + 1 }).eq('id', otp.id);
    throw new UnauthorizedError('That code is not right. Check it and try again.');
  }
  await db.from('phone_otps').update({ consumed_at: new Date().toISOString() }).eq('id', otp.id);

  let { data: userRow } = await db.from('users').select('*').eq('phone', phone).maybeSingle();
  let isNewUser = false;
  if (!userRow) {
    const { data: created, error: createErr } = await db
      .from('users')
      .insert({ phone, status: 'active' })
      .select()
      .single();
    if (createErr || !created) throw new Error(`Failed to create user: ${createErr?.message}`);
    userRow = created;
    isNewUser = true;
  }
  if (userRow!.status && userRow!.status !== 'active') {
    throw new UnauthorizedError('This account is not active.');
  }

  await db.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', userRow!.id);

  const user = rowToUser(userRow!);
  return {
    accessToken: generateAccessToken(user.id, user.email),
    refreshToken: generateRefreshToken(user.id),
    user,
    isNewUser,
  };
}

export interface OnboardingInput {
  fullName: string;
  city: string;
  bike?: string;
  termsAccepted: boolean;
  locationConsent: boolean;
  recognitionOptIn: boolean;
}

export async function completeOnboarding(userId: string, input: OnboardingInput): Promise<User> {
  if (!input.termsAccepted || !input.locationConsent) {
    throw new ValidationError('Terms and location consent are required to continue');
  }
  const db = getDatabase();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from('users')
    .update({
      full_name: input.fullName.trim(),
      city: input.city.trim(),
      bike: input.bike?.trim() || null,
      terms_accepted_at: now,
      location_consent_at: now,
      recognition_opt_in: input.recognitionOptIn,
      onboarding_completed_at: now,
      updated_at: now,
    })
    .eq('id', userId)
    .select()
    .single();
  if (error || !data) throw new Error(`Failed to save profile: ${error?.message}`);
  return rowToUser(data);
}
