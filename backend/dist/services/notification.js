"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserNotifications = getUserNotifications;
exports.markAsRead = markAsRead;
exports.markAllAsRead = markAllAsRead;
exports.createNotification = createNotification;
const database_1 = require("@risk-radar/database");
async function getUserNotifications(userId) {
    const notifications = await (0, database_1.query)(`SELECT id, "userId", type, title, message, data, "read", "createdAt"
     FROM "Notification"
     WHERE "userId" = $1
     ORDER BY "createdAt" DESC
     LIMIT 50`, [userId]);
    return notifications;
}
async function markAsRead(id) {
    await (0, database_1.query)(`UPDATE "Notification" SET "read" = true WHERE id = $1`, [id]);
}
async function markAllAsRead(userId) {
    await (0, database_1.query)(`UPDATE "Notification" SET "read" = true WHERE "userId" = $1 AND "read" = false`, [
        userId,
    ]);
}
async function createNotification(userId, type, title, message, data) {
    const rows = await (0, database_1.query)(`INSERT INTO "Notification" ("userId", type, title, message, data, "read", "createdAt")
     VALUES ($1, $2, $3, $4, $5::jsonb, false, NOW())
     RETURNING id, "userId", type, title, message, data, "read", "createdAt"`, [userId, type, title, message, JSON.stringify(data || {})]);
    if (!rows[0])
        throw new Error('Failed to create notification');
    return rows[0];
}
//# sourceMappingURL=notification.js.map