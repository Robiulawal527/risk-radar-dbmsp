
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
export async function searchUsersBySkill(skill: string): Promise<User[]> {
  const rows = await query<UserRow>(
    `SELECT * FROM "User" 
     WHERE EXISTS (
       SELECT 1 FROM unnest(skills) AS s
       WHERE s ILIKE '%' || $1 || '%'
     )`,
    [skill]
  );
  return rows.map(toUser);
}
