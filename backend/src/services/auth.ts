import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { query, queryOne } from '@risk-radar/database';
import { config } from '@risk-radar/config';
import type { AuthToken, LoginCredentials, SignupData, User } from '@risk-radar/types';
import { HttpError } from '../lib/http-error.js';

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
};

function toUser(row: UserRow): User {
  const { password: _p, ...rest } = row;
  return rest as User;
}

export async function signup(signupData: SignupData): Promise<AuthToken> {
  if (!signupData.password || signupData.password.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters');
  }

  const existingUser = await queryOne<UserRow>('SELECT * FROM "User" WHERE email = $1', [
    signupData.email,
  ]);

  if (existingUser) {
    throw new HttpError(409, 'User already exists');
  }

  const hashedPassword = await bcrypt.hash(signupData.password, 10);

  const row = await queryOne<UserRow>(
    `INSERT INTO "User" (email, password, name, phone, role, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'USER', NOW(), NOW())
     RETURNING *`,
    [signupData.email, hashedPassword, signupData.name, signupData.phone ?? null]
  );

  if (!row) throw new HttpError(500, 'Failed to create user');
  return generateTokens(row.id, row.email);
}

export async function login(credentials: LoginCredentials): Promise<AuthToken> {
  const user = await queryOne<UserRow>('SELECT * FROM "User" WHERE email = $1', [
    credentials.email,
  ]);

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
  } | null = null;
  try {
    profile = await queryOne<{
      full_name: string | null;
      phone: string | null;
      avatar: string | null;
      role: string | null;
    }>('SELECT full_name, phone, avatar, role FROM public.profiles WHERE id = $1', [supabaseUser.id]);
  } catch {
    // Missing table, wrong name, or DB mismatch — still create/sync local User from Supabase + metadata.
  }

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
      profile?.phone ?? ((supabaseUser.user_metadata?.phone as string | undefined) ?? null);

    localUser = await queryOne<UserRow>(
      `INSERT INTO "User" (id, email, password, name, phone, role, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'USER', NOW(), NOW())
       RETURNING *`,
      [supabaseUser.id, supabaseUser.email, hashedPassword, name, phone]
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
