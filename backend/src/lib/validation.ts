import { HttpError } from './http-error.js';

export function normalizeEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Enter a valid email address');
  }
  return email;
}

export function normalizeRequiredText(value: unknown, field: string, min = 1, max = 500): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min) {
    throw new HttpError(400, `${field} must be at least ${min} character${min === 1 ? '' : 's'}`);
  }
  if (text.length > max) {
    throw new HttpError(400, `${field} must be ${max} characters or less`);
  }
  return text;
}

export function normalizeOptionalText(value: unknown, max = 500): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) {
    throw new HttpError(400, `Text must be ${max} characters or less`);
  }
  return text;
}

export function normalizePhoneNumber(value: unknown): string | null {
  if (value == null || value === '') return null;
  const digits = String(value).trim().replace(/\D/g, '');
  const phone =
    digits.length === 13 && digits.startsWith('880')
      ? `0${digits.slice(3)}`
      : digits.length === 14 && digits.startsWith('0880')
        ? `0${digits.slice(4)}`
        : digits;
  if (!/^01\d{9}$/.test(phone)) {
    throw new HttpError(400, 'Phone number must be 11 digits and start with 01, e.g. 01712345678');
  }
  return phone;
}

export function normalizeFiniteNumber(value: unknown, field: string): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) {
    throw new HttpError(400, `${field} must be a valid number`);
  }
  return number;
}
