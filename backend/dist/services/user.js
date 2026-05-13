"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = updateProfile;
exports.changePassword = changePassword;
const bcrypt = __importStar(require("bcryptjs"));
const database_1 = require("@risk-radar/database");
const http_error_js_1 = require("../lib/http-error.js");
function toUser(row) {
    const { password: _p, ...rest } = row;
    return rest;
}
async function updateProfile(userId, data) {
    const sets = ['"updatedAt" = NOW()'];
    const values = [];
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
    values.push(userId);
    const row = await (0, database_1.queryOne)(`UPDATE "User" SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
    if (!row)
        throw new http_error_js_1.HttpError(404, 'User not found');
    return toUser(row);
}
async function changePassword(userId, currentPassword, newPassword) {
    if (!newPassword || newPassword.length < 6) {
        throw new http_error_js_1.HttpError(400, 'New password must be at least 6 characters');
    }
    const user = await (0, database_1.queryOne)('SELECT * FROM "User" WHERE id = $1', [userId]);
    if (!user) {
        throw new http_error_js_1.HttpError(401, 'User not found');
    }
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
        throw new http_error_js_1.HttpError(401, 'Current password is incorrect');
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await (0, database_1.query)(`UPDATE "User" SET password = $2, "updatedAt" = NOW() WHERE id = $1`, [
        userId,
        hashedPassword,
    ]);
}
//# sourceMappingURL=user.js.map