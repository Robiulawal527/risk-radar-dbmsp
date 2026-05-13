"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_2 = require("express");
const http_error_js_1 = require("./lib/http-error.js");
const health_js_1 = require("./routes/health.js");
const auth_js_1 = require("./routes/auth.js");
const crimes_js_1 = require("./routes/crimes.js");
const users_js_1 = require("./routes/users.js");
const analytics_js_1 = require("./routes/analytics.js");
const predictions_js_1 = require("./routes/predictions.js");
const sos_js_1 = require("./routes/sos.js");
const notifications_js_1 = require("./routes/notifications.js");
const heatmap_js_1 = require("./routes/heatmap.js");
function corsOrigin(origin, callback) {
    const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    const defaults = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:19006'];
    const allowList = new Set([...defaults, ...configuredOrigins]);
    if (!origin) {
        return callback(null, true);
    }
    if (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
        return callback(null, true);
    }
    if (allowList.has(origin)) {
        return callback(null, true);
    }
    // Vercel preview + production deployments (https://*.vercel.app)
    if (/^https:\/\/[^/]+\.vercel\.app$/i.test(origin)) {
        return callback(null, true);
    }
    return callback(null, false);
}
function createApp() {
    const app = (0, express_1.default)();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.get('/', (_req, res) => {
        res.json({
            name: 'Risk Radar API',
            health: '/api/health',
            api: '/api',
        });
    });
    app.use(express_1.default.json({ limit: '2mb' }));
    app.use((0, cors_1.default)({
        origin: corsOrigin,
        credentials: true,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }));
    const api = (0, express_2.Router)();
    api.use('/health', health_js_1.healthRouter);
    api.use('/auth', auth_js_1.authRouter);
    api.use('/crimes', crimes_js_1.crimesRouter);
    api.use('/users', users_js_1.usersRouter);
    api.use('/analytics', analytics_js_1.analyticsRouter);
    api.use('/predictions', predictions_js_1.predictionsRouter);
    api.use('/sos', sos_js_1.sosRouter);
    api.use('/notifications', notifications_js_1.notificationsRouter);
    api.use('/heatmap', heatmap_js_1.heatmapRouter);
    app.use('/api', api);
    app.use((err, _req, res, _next) => {
        if (err instanceof http_error_js_1.HttpError) {
            return res.status(err.statusCode).json({ success: false, error: err.message });
        }
        console.error(err);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    });
    return app;
}
//# sourceMappingURL=app.js.map