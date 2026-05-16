import type { AuthUser } from '@/store/auth';
import type { UserRole } from '@/lib/types';

export type AuthTokenResponse = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};

export function mapAuthUser(u: Record<string, unknown>): AuthUser {
  return {
    id: String(u.id),
    name: String(u.name ?? u.full_name ?? ''),
    email: String(u.email ?? ''),
    role: (String(u.role ?? 'USER').toUpperCase() as UserRole) || 'USER',
    avatar: u.avatar != null ? String(u.avatar) : undefined,
    phone: u.phone != null ? String(u.phone) : undefined,
    skills: Array.isArray(u.skills) ? u.skills.map(String) : [],
    alertLatitude:
      typeof u.alertLatitude === 'number'
        ? u.alertLatitude
        : typeof u.alert_latitude === 'number'
          ? u.alert_latitude
          : null,
    alertLongitude:
      typeof u.alertLongitude === 'number'
        ? u.alertLongitude
        : typeof u.alert_longitude === 'number'
          ? u.alert_longitude
          : null,
    alertsEnabled:
      typeof u.alertsEnabled === 'boolean'
        ? u.alertsEnabled
        : typeof u.alerts_enabled === 'boolean'
          ? u.alerts_enabled
          : u.alertsEnabled == null && u.alerts_enabled == null
            ? null
            : Boolean(u.alertsEnabled ?? u.alerts_enabled),
  };
}
