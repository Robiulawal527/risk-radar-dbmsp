import { query } from '@risk-radar/database';
import type { Notification, NotificationType } from '@risk-radar/types';

export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const notifications = await query<Notification>(
    `SELECT id, "userId", type, title, message, data, "read", "createdAt"
     FROM "Notification"
     WHERE "userId" = $1
     ORDER BY "createdAt" DESC
     LIMIT 50`,
    [userId]
  );

  return notifications;
}

export async function markAsRead(id: string): Promise<void> {
  await query(`UPDATE "Notification" SET "read" = true WHERE id = $1`, [id]);
}

export async function markAllAsRead(userId: string): Promise<void> {
  await query(`UPDATE "Notification" SET "read" = true WHERE "userId" = $1 AND "read" = false`, [
    userId,
  ]);
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown>
): Promise<Notification> {
  const rows = await query<Notification>(
    `INSERT INTO "Notification" ("userId", type, title, message, data, "read", "createdAt")
     VALUES ($1, $2, $3, $4, $5::jsonb, false, NOW())
     RETURNING id, "userId", type, title, message, data, "read", "createdAt"`,
    [userId, type, title, message, JSON.stringify(data || {})]
  );

  if (!rows[0]) throw new Error('Failed to create notification');
  return rows[0];
}
