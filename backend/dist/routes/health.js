"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const express_1 = require("express");
const database_1 = require("@risk-radar/database");
const async_handler_js_1 = require("../lib/async-handler.js");
exports.healthRouter = (0, express_1.Router)();
exports.healthRouter.get('/', (0, async_handler_js_1.asyncHandler)(async (_req, res) => {
    try {
        await database_1.pool.query('SELECT 1');
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: 'connected',
        });
    }
    catch (error) {
        const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
        const message = error instanceof Error ? error.message : 'Unknown database error';
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: isProd ? 'Database unavailable' : message,
        });
    }
}));
//# sourceMappingURL=health.js.map