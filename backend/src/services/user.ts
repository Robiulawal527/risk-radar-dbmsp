import * as bcrypt from 'bcryptjs';
import { query, queryOne } from '@risk-radar/database';
import type { User } from '@risk-radar/types';
import { HttpError } from '../lib/http-error.js';

type UserRow = {
  id: string;
  email: string;
  password: string;
  name: string;
  phone: string | null;
  avatar: string | null;
  role: string | null;
  alertLatitude: number | null;
  alertLongitude: number | null;
  alertsEnabled: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  skills: string[] | null;
};

function toUser(row: UserRow): User {
  const { password: _p, ...rest } = row;
  return rest as User;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function syncProfileToSupabase(row: UserRow): Promise<void> {
  if (!isUuid(row.id)) return;

  try {
    await query(
      `INSERT INTO public.profiles (
         id, email, full_name, phone, avatar, role, skills,
         alert_latitude, alert_longitude, alerts_enabled, updated_at
       )
       VALUES ($1::uuid, $2, $3, $4, $5, COALESCE($6, 'USER'), $7, $8, $9, COALESCE($10, true), NOW())
       ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email,
             full_name = EXCLUDED.full_name,
             phone = EXCLUDED.phone,
             avatar = EXCLUDED.avatar,
             role = EXCLUDED.role,
             skills = EXCLUDED.skills,
             alert_latitude = EXCLUDED.alert_latitude,
             alert_longitude = EXCLUDED.alert_longitude,
             alerts_enabled = EXCLUDED.alerts_enabled,
             updated_at = NOW()`,
      [
        row.id,
        row.email,
        row.name,
        row.phone,
        row.avatar,
        row.role,
        row.skills ?? [],
        row.alertLatitude,
        row.alertLongitude,
        row.alertsEnabled,
      ]
    );
  } catch {
    // Older databases may not have the Supabase profile extension columns yet.
  }
}

export async function updateProfile(
  userId: string,
  data: {
    name?: string;
    phone?: string;
    avatar?: string;
    alertLatitude?: number | null;
    alertLongitude?: number | null;
    alertsEnabled?: boolean;
    skills?: string[];
  }
): Promise<User> {
  const sets: string[] = ['"updatedAt" = NOW()'];
  const values: unknown[] = [];
  let i = 1;

  if (data.name !== undefined) {
    sets.push(`name = $${i++}`);
    values.push(data.name);
  }
  if (data.phone !== undefined) {
    sets.push(`phone = $${i++}`);
    values.push(data.phone);
  }
  if (data.avatar !== undefined) {
    sets.push(`avatar = $${i++}`);
    values.push(data.avatar);
  }
  if (data.alertLatitude !== undefined) {
    sets.push(`"alertLatitude" = $${i++}`);
    values.push(data.alertLatitude);
  }
  if (data.alertLongitude !== undefined) {
    sets.push(`"alertLongitude" = $${i++}`);
    values.push(data.alertLongitude);
  }
  if (data.alertsEnabled !== undefined) {
    sets.push(`"alertsEnabled" = $${i++}`);
    values.push(data.alertsEnabled);
  }
  if (data.skills !== undefined) {
    sets.push(`skills = $${i++}`);
    values.push(data.skills);
  }

  values.push(userId);
  const row = await queryOne<UserRow>(
    `UPDATE "User" SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );

  if (!row) throw new HttpError(404, 'User not found');
  await syncProfileToSupabase(row);
  return toUser(row);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (!newPassword || newPassword.length < 6) {
    throw new HttpError(400, 'New password must be at least 6 characters');
  }

  const user = await queryOne<UserRow>('SELECT * FROM "User" WHERE id = $1', [userId]);

  if (!user) {
    throw new HttpError(401, 'User not found');
  }

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    throw new HttpError(401, 'Current password is incorrect');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await query(`UPDATE "User" SET password = $2, "updatedAt" = NOW() WHERE id = $1`, [
    userId,
    hashedPassword,
  ]);
}

// Search users by skill (case-insensitive)
export async function searchUsersBySkill(skill: string, currentUserId?: string): Promise<User[]> {
  const rows = await query<UserRow>(
    `SELECT * FROM "User"
     WHERE ($2::text IS NULL OR id <> $2)
       AND
       EXISTS (
       SELECT 1 FROM unnest(COALESCE(skills, ARRAY[]::text[])) AS s
       WHERE s ILIKE '%' || $1 || '%'
     )
     ORDER BY name ASC
     LIMIT 50`,
    [skill, currentUserId ?? null]
  );
  return rows.map(toUser);
}
