import fs from 'fs';
import path from 'path';
import { getDatabase } from '../config/database';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch { /* silent */ }
}

export function readLocalProfiles(): Record<string, Record<string, unknown>> {
  try {
    ensureDataDir();
    if (fs.existsSync(PROFILES_FILE)) {
      const raw = fs.readFileSync(PROFILES_FILE, 'utf-8');
      return JSON.parse(raw) || {};
    }
  } catch (err) {
    console.warn('[profile.service] readLocalProfiles failed:', err);
  }
  return {};
}

export function writeLocalProfile(userId: string, data: Record<string, unknown>): void {
  try {
    ensureDataDir();
    const all = readLocalProfiles();
    all[userId] = {
      ...(all[userId] || {}),
      ...data,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(all, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[profile.service] writeLocalProfile failed:', err);
  }
}

export interface RiderProfileData {
  userId: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  phone?: string | null;
  bloodGroup?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  allergies?: string | null;
  medicalNotes?: string | null;
  bikeModel?: string | null;
  bikeRegNo?: string | null;
  drivingLicenseNo?: string | null;
  ridingStyle?: string | null;
  city?: string | null;
  bio?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string;
  bloodGroup?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  allergies?: string;
  medicalNotes?: string;
  bikeModel?: string;
  bikeRegNo?: string;
  drivingLicenseNo?: string;
  ridingStyle?: string;
  city?: string;
  bio?: string;
}

export async function getProfile(userId: string): Promise<RiderProfileData> {
  const db = getDatabase();

  // 1. Fetch user base info
  const { data: user, error: userErr } = await db
    .from('users')
    .select('id, email, full_name, avatar_url, created_at')
    .eq('id', userId)
    .single();

  if (userErr || !user) {
    throw new Error('User not found');
  }

  // 2. Try fetching rider_profiles row from Supabase
  let profileRow: Record<string, unknown> | null = null;
  try {
    const { data: profile, error: profileErr } = await db
      .from('rider_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (!profileErr && profile) {
      profileRow = profile;
    }
  } catch (err) {
    console.warn('[profile.service] rider_profiles query fallback:', err);
  }

  // 3. Fallback: Check local persistent store
  if (!profileRow || Object.keys(profileRow).length === 0) {
    const localProfiles = readLocalProfiles();
    if (localProfiles[userId]) {
      profileRow = localProfiles[userId];
    }
  }

  // 4. Fallback: If audit_logs exists, load from latest snapshot
  if (!profileRow || Object.keys(profileRow).length === 0) {
    try {
      const { data: logEntry } = await db
        .from('audit_logs')
        .select('details')
        .eq('user_id', userId)
        .eq('action', 'RIDER_PROFILE')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (logEntry?.details && typeof logEntry.details === 'object') {
        profileRow = logEntry.details as Record<string, unknown>;
      }
    } catch { /* silent fallback */ }
  }

  return {
    userId: user.id,
    fullName: user.full_name || '',
    email: user.email,
    avatarUrl: user.avatar_url,
    phone: (profileRow?.phone as string) || null,
    bloodGroup: (profileRow?.blood_group as string) || null,
    emergencyContactName: (profileRow?.emergency_contact_name as string) || null,
    emergencyContactPhone: (profileRow?.emergency_contact_phone as string) || null,
    emergencyContactRelation: (profileRow?.emergency_contact_relation as string) || null,
    allergies: (profileRow?.allergies as string) || null,
    medicalNotes: (profileRow?.medical_notes as string) || null,
    bikeModel: (profileRow?.bike_model as string) || null,
    bikeRegNo: (profileRow?.bike_reg_no as string) || null,
    drivingLicenseNo: (profileRow?.driving_license_no as string) || null,
    ridingStyle: (profileRow?.riding_style as string) || 'Adventure / Touring',
    city: (profileRow?.city as string) || null,
    bio: (profileRow?.bio as string) || null,
    createdAt: user.created_at,
    updatedAt: (profileRow?.updated_at as string) || user.created_at,
  };
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<RiderProfileData> {
  const db = getDatabase();

  // 1. Update user full_name if provided
  if (input.fullName && input.fullName.trim()) {
    await db
      .from('users')
      .update({ full_name: input.fullName.trim() })
      .eq('id', userId);
  }

  // 2. Prepare rider_profiles row
  const profileRow: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  if (input.phone !== undefined) profileRow.phone = input.phone?.trim() || null;
  if (input.bloodGroup !== undefined) profileRow.blood_group = input.bloodGroup?.trim().toUpperCase() || null;
  if (input.emergencyContactName !== undefined) profileRow.emergency_contact_name = input.emergencyContactName?.trim() || null;
  if (input.emergencyContactPhone !== undefined) profileRow.emergency_contact_phone = input.emergencyContactPhone?.trim() || null;
  if (input.emergencyContactRelation !== undefined) profileRow.emergency_contact_relation = input.emergencyContactRelation?.trim() || null;
  if (input.allergies !== undefined) profileRow.allergies = input.allergies?.trim() || null;
  if (input.medicalNotes !== undefined) profileRow.medical_notes = input.medicalNotes?.trim() || null;
  if (input.bikeModel !== undefined) profileRow.bike_model = input.bikeModel?.trim() || null;
  if (input.bikeRegNo !== undefined) profileRow.bike_reg_no = input.bikeRegNo?.trim().toUpperCase() || null;
  if (input.drivingLicenseNo !== undefined) profileRow.driving_license_no = input.drivingLicenseNo?.trim().toUpperCase() || null;
  if (input.ridingStyle !== undefined) profileRow.riding_style = input.ridingStyle?.trim() || 'Adventure / Touring';
  if (input.city !== undefined) profileRow.city = input.city?.trim() || null;
  if (input.bio !== undefined) profileRow.bio = input.bio?.trim() || null;

  // 3. Immediately persist to local persistent store so data is never lost
  writeLocalProfile(userId, profileRow);

  // 4. Try to save to Supabase rider_profiles table (if migrated)
  try {
    const { data: existing } = await db
      .from('rider_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing?.id) {
      const { error: updateErr } = await db
        .from('rider_profiles')
        .update(profileRow)
        .eq('user_id', userId);
      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await db
        .from('rider_profiles')
        .insert(profileRow);
      if (insertErr) {
        const { error: upsertErr } = await db
          .from('rider_profiles')
          .upsert(profileRow, { onConflict: 'user_id' });
        if (upsertErr) throw upsertErr;
      }
    }
  } catch (err) {
    console.warn('[profile.service] rider_profiles table save attempt:', err);
  }

  // 5. Also attempt to save to audit_logs (if available)
  try {
    await db.from('audit_logs').insert({
      user_id: userId,
      action: 'RIDER_PROFILE',
      resource: 'rider_profile',
      resource_id: userId,
      details: profileRow,
    });
  } catch (err) {
    console.warn('[profile.service] audit_logs backup save note:', err);
  }

  return getProfile(userId);
}

export async function getRiderCard(userId: string) {
  const profile = await getProfile(userId);
  return {
    userId: profile.userId,
    fullName: profile.fullName,
    bloodGroup: profile.bloodGroup,
    emergencyContactName: profile.emergencyContactName,
    emergencyContactPhone: profile.emergencyContactPhone,
    emergencyContactRelation: profile.emergencyContactRelation,
    allergies: profile.allergies,
    medicalNotes: profile.medicalNotes,
    bikeModel: profile.bikeModel,
    bikeRegNo: profile.bikeRegNo,
    city: profile.city,
  };
}

