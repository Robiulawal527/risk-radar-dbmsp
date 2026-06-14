export const PHONE_HINT = 'Use exactly 11 digits, e.g. 01712345678.';
export const NID_HINT = 'NID must be exactly 10, 13, or 17 digits.';

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

export function normalizeNidNumber(value: string): string {
  return value.trim().replace(/\D/g, '');
}

export function requireValidNidNumber(value: string): string {
  const nid = normalizeNidNumber(value);
  if (![10, 13, 17].includes(nid.length)) {
    throw new Error(NID_HINT);
  }
  return nid;
}

export function requireValidEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address.');
  }
  return email;
}
