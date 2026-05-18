export const PHONE_HINT = 'Use exactly 11 digits, e.g. 01712345678.';

export function normalizePhoneNumber(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('880')) return `0${digits.slice(3)}`;
  if (digits.length === 14 && digits.startsWith('0880')) return `0${digits.slice(4)}`;
  return digits;
}

export function isValidPhoneNumber(value: string): boolean {
  const phone = normalizePhoneNumber(value);
  return phone.length === 0 || /^01\d{9}$/.test(phone);
}

export function requireValidPhoneNumber(value: string): string {
  const phone = normalizePhoneNumber(value);
  if (!phone) return '';
  if (!/^01\d{9}$/.test(phone)) {
    throw new Error(`Phone number must be 11 digits and start with 01. ${PHONE_HINT}`);
  }
  return phone;
}
