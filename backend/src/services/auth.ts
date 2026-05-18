import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { query, queryOne } from '@risk-radar/database';
import { config } from '@risk-radar/config';
import {
  UserRole,
  type AuthToken,
  type LoginCredentials,
  type SignupData,
  type User,
} from '@risk-radar/types';
import { HttpError } from '../lib/http-error.js';
import { normalizeEmail, normalizePhoneNumber, normalizeRequiredText } from '../lib/validation.js';

const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey || config.supabase.anonKey
);

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

export async function signup(signupData: SignupData): Promise<AuthToken> {
  const email = normalizeEmail(signupData.email);
  const name = normalizeRequiredText(signupData.name, 'Full name', 2, 120);
  const phone = normalizePhoneNumber(signupData.phone);
  if (!signupData.password || signupData.password.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters');
  }

  const existingUser = await queryOne<UserRow>('SELECT * FROM "User" WHERE lower(email) = $1', [
    email,
  ]);

  if (existingUser) {
    throw new HttpError(409, 'User already exists');
  }

  const hashedPassword = await bcrypt.hash(signupData.password, 10);
  const requestedRole =
    (signupData as SignupData & { role?: UserRole }).role === UserRole.ADMIN
      ? UserRole.ADMIN
      : UserRole.USER;

  const row = await queryOne<UserRow>(
    `INSERT INTO "User" (email, password, name, phone, role, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING *`,
    [email, hashedPassword, name, phone, requestedRole]
  );

  if (!row) throw new HttpError(500, 'Failed to create user');

  if (requestedRole === UserRole.ADMIN) {
    await query(
      `INSERT INTO admins (id, email, name, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email, name = EXCLUDED.name, "updatedAt" = NOW()`,
      [row.id, row.email, row.name]
    ).catch(() => undefined);
  }

  return generateTokens(row.id, row.email);
}

export async function login(credentials: LoginCredentials): Promise<AuthToken> {
  const email = normalizeEmail(credentials.email);
  const user = await queryOne<UserRow>('SELECT * FROM "User" WHERE lower(email) = $1', [email]);

  if (!user) {
    throw new HttpError(401, 'Invalid credentials');
  }

  const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

  if (!isPasswordValid) {
    throw new HttpError(401, 'Invalid credentials');
  }

  return generateTokens(user.id, user.email);
}

export async function validateUser(userId: string): Promise<User> {
  const user = await queryOne<UserRow>('SELECT * FROM "User" WHERE id = $1', [userId]);

  if (!user) {
    throw new HttpError(401, 'User not found');
  }

  return toUser(user);
}

export async function validateSupabaseToken(accessToken: string): Promise<User> {
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.email) {
    throw new HttpError(401, 'Invalid Supabase token');
  }

  const supabaseUser = data.user;
  let profile: {
    full_name: string | null;
    phone: string | null;
    avatar: string | null;
    role: string | null;
    skills: string[] | null;
    alertLatitude: number | null;
    alertLongitude: number | null;
    alertsEnabled: boolean | null;
  } | null = null;
  let adminRecord: { id: string } | null = null;
  try {
    profile = await queryOne<{
      full_name: string | null;
      phone: string | null;
      avatar: string | null;
      role: string | null;
      skills: string[] | null;
      alertLatitude: number | null;
      alertLongitude: number | null;
      alertsEnabled: boolean | null;
    }>(
      `SELECT full_name, phone, avatar, role, skills,
        alert_latitude AS "alertLatitude",
        alert_longitude AS "alertLongitude",
        alerts_enabled AS "alertsEnabled"
       FROM public.profiles
       WHERE id = $1`,
      [supabaseUser.id]
    );
  } catch {
    // Missing table, wrong name, or DB mismatch — still create/sync local User from Supabase + metadata.
  }
  try {
    adminRecord = await queryOne<{ id: string }>(
      `SELECT id FROM admins WHERE id = $1 OR email = $2`,
      [supabaseUser.id, supabaseUser.email]
    );
  } catch {
    // The admins table is optional in older deployments.
  }

  const metadataRole = String(supabaseUser.user_metadata?.role ?? '').toUpperCase();
  const resolvedRole =
    adminRecord || profile?.role === UserRole.ADMIN || metadataRole === UserRole.ADMIN
      ? UserRole.ADMIN
      : UserRole.USER;

  let localUser = await queryOne<UserRow>('SELECT * FROM "User" WHERE email = $1', [
    supabaseUser.email,
  ]);

  if (!localUser) {
    const hashedPassword = await bcrypt.hash(randomUUID(), 10);
    const name =
      profile?.full_name ||
      (supabaseUser.user_metadata?.name as string | undefined) ||
      supabaseUser.email.split('@')[0] ||
      'User';
    const phone =
      profile?.phone ?? (supabaseUser.user_metadata?.phone as string | undefined) ?? null;

    localUser = await queryOne<UserRow>(
      `INSERT INTO "User" (
         id, email, password, name, phone, role, skills,
         "alertLatitude", "alertLongitude", "alertsEnabled", "createdAt", "updatedAt"
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, true), NOW(), NOW())
       RETURNING *`,
      [
        supabaseUser.id,
        supabaseUser.email,
        hashedPassword,
        name,
        phone,
        resolvedRole,
        profile?.skills ?? [],
        profile?.alertLatitude ?? null,
        profile?.alertLongitude ?? null,
        profile?.alertsEnabled ?? true,
      ]
    );
  } else if (profile || resolvedRole === UserRole.ADMIN) {
    localUser = await queryOne<UserRow>(
      `UPDATE "User"
       SET name = COALESCE($2, name),
           phone = COALESCE($3, phone),
           avatar = COALESCE($4, avatar),
           role = $5,
           skills = COALESCE($6, skills),
           "alertLatitude" = COALESCE($7, "alertLatitude"),
           "alertLongitude" = COALESCE($8, "alertLongitude"),
           "alertsEnabled" = COALESCE($9, "alertsEnabled"),
           "updatedAt" = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        localUser.id,
        profile?.full_name ?? null,
        profile?.phone ?? null,
        profile?.avatar ?? null,
        resolvedRole,
        profile?.skills ?? null,
        profile?.alertLatitude ?? null,
        profile?.alertLongitude ?? null,
        profile?.alertsEnabled ?? null,
      ]
    );
  }

  if (!localUser) throw new HttpError(500, 'Failed to resolve user');
  return toUser(localUser);
}

function generateTokens(userId: string, email: string): AuthToken {
  const payload = { sub: userId, email };
  const secret = config.auth.jwtSecret;
  const accessToken = jwt.sign(payload, secret, {
    expiresIn: config.auth.jwtExpiresIn || '7d',
  } as jwt.SignOptions);
  const refreshToken = jwt.sign(payload, secret, {
    expiresIn: config.auth.refreshTokenExpiresIn || '30d',
  } as jwt.SignOptions);

  return {
    accessToken,
    refreshToken,
    expiresIn: 7 * 24 * 60 * 60,
  };
}
