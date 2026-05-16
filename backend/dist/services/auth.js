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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signup = signup;
exports.login = login;
exports.validateUser = validateUser;
exports.validateSupabaseToken = validateSupabaseToken;
const bcrypt = __importStar(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const supabase_js_1 = require("@supabase/supabase-js");
const crypto_1 = require("crypto");
const database_1 = require("@risk-radar/database");
const config_1 = require("@risk-radar/config");
const http_error_js_1 = require("../lib/http-error.js");
const supabase = (0, supabase_js_1.createClient)(config_1.config.supabase.url, config_1.config.supabase.serviceRoleKey || config_1.config.supabase.anonKey);
function toUser(row) {
    const { password: _p, ...rest } = row;
    return rest;
}
async function signup(signupData) {
    if (!signupData.password || signupData.password.length < 8) {
        throw new http_error_js_1.HttpError(400, 'Password must be at least 8 characters');
    }
    const existingUser = await (0, database_1.queryOne)('SELECT * FROM "User" WHERE email = $1', [
        signupData.email,
    ]);
    if (existingUser) {
        throw new http_error_js_1.HttpError(409, 'User already exists');
    }
    const hashedPassword = await bcrypt.hash(signupData.password, 10);
    const row = await (0, database_1.queryOne)(`INSERT INTO "User" (email, password, name, phone, role, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'USER', NOW(), NOW())
     RETURNING *`, [signupData.email, hashedPassword, signupData.name, signupData.phone ?? null]);
    if (!row)
        throw new http_error_js_1.HttpError(500, 'Failed to create user');
    return generateTokens(row.id, row.email);
}
async function login(credentials) {
    const user = await (0, database_1.queryOne)('SELECT * FROM "User" WHERE email = $1', [
        credentials.email,
    ]);
    if (!user) {
        throw new http_error_js_1.HttpError(401, 'Invalid credentials');
    }
    const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
    if (!isPasswordValid) {
        throw new http_error_js_1.HttpError(401, 'Invalid credentials');
    }
    return generateTokens(user.id, user.email);
}
async function validateUser(userId) {
    const user = await (0, database_1.queryOne)('SELECT * FROM "User" WHERE id = $1', [userId]);
    if (!user) {
        throw new http_error_js_1.HttpError(401, 'User not found');
    }
    return toUser(user);
}
async function validateSupabaseToken(accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user?.email) {
        throw new http_error_js_1.HttpError(401, 'Invalid Supabase token');
    }
    const supabaseUser = data.user;
    let profile = null;
    try {
        profile = await (0, database_1.queryOne)(`SELECT full_name, phone, avatar, role, skills,
        alert_latitude AS "alertLatitude",
        alert_longitude AS "alertLongitude",
        alerts_enabled AS "alertsEnabled"
       FROM public.profiles
       WHERE id = $1`, [supabaseUser.id]);
    }
    catch {
        // Missing table, wrong name, or DB mismatch — still create/sync local User from Supabase + metadata.
    }
    let localUser = await (0, database_1.queryOne)('SELECT * FROM "User" WHERE email = $1', [
        supabaseUser.email,
    ]);
    if (!localUser) {
        const hashedPassword = await bcrypt.hash((0, crypto_1.randomUUID)(), 10);
        const name = profile?.full_name ||
            supabaseUser.user_metadata?.name ||
            supabaseUser.email.split('@')[0] ||
            'User';
        const phone = profile?.phone ?? supabaseUser.user_metadata?.phone ?? null;
        localUser = await (0, database_1.queryOne)(`INSERT INTO "User" (
         id, email, password, name, phone, role, skills,
         "alertLatitude", "alertLongitude", "alertsEnabled", "createdAt", "updatedAt"
       )
       VALUES ($1, $2, $3, $4, $5, 'USER', $6, $7, $8, COALESCE($9, true), NOW(), NOW())
       RETURNING *`, [
            supabaseUser.id,
            supabaseUser.email,
            hashedPassword,
            name,
            phone,
            profile?.skills ?? [],
            profile?.alertLatitude ?? null,
            profile?.alertLongitude ?? null,
            profile?.alertsEnabled ?? true,
        ]);
    }
    else if (profile) {
        localUser = await (0, database_1.queryOne)(`UPDATE "User"
       SET name = COALESCE($2, name),
           phone = COALESCE($3, phone),
           avatar = COALESCE($4, avatar),
           role = COALESCE($5, role),
           skills = COALESCE($6, skills),
           "alertLatitude" = COALESCE($7, "alertLatitude"),
           "alertLongitude" = COALESCE($8, "alertLongitude"),
           "alertsEnabled" = COALESCE($9, "alertsEnabled"),
           "updatedAt" = NOW()
       WHERE id = $1
       RETURNING *`, [
            localUser.id,
            profile.full_name,
            profile.phone,
            profile.avatar,
            profile.role,
            profile.skills,
            profile.alertLatitude,
            profile.alertLongitude,
            profile.alertsEnabled,
        ]);
    }
    if (!localUser)
        throw new http_error_js_1.HttpError(500, 'Failed to resolve user');
    return toUser(localUser);
}
function generateTokens(userId, email) {
    const payload = { sub: userId, email };
    const secret = config_1.config.auth.jwtSecret;
    const accessToken = jsonwebtoken_1.default.sign(payload, secret, {
        expiresIn: config_1.config.auth.jwtExpiresIn || '7d',
    });
    const refreshToken = jsonwebtoken_1.default.sign(payload, secret, {
        expiresIn: config_1.config.auth.refreshTokenExpiresIn || '30d',
    });
    return {
        accessToken,
        refreshToken,
        expiresIn: 7 * 24 * 60 * 60,
    };
}
//# sourceMappingURL=auth.js.map