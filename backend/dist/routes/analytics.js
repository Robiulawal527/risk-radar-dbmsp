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
exports.analyticsRouter = void 0;
const express_1 = require("express");
const analyticsService = __importStar(require("../services/analytics.js"));
const async_handler_js_1 = require("../lib/async-handler.js");
const auth_js_1 = require("../middleware/auth.js");
exports.analyticsRouter = (0, express_1.Router)();
exports.analyticsRouter.use(auth_js_1.requireAuth);
exports.analyticsRouter.get('/stats', (0, async_handler_js_1.asyncHandler)(async (_req, res) => {
    const stats = await analyticsService.getCrimeStats();
    res.json({ success: true, data: stats });
}));
exports.analyticsRouter.get('/rankings/areas', (0, async_handler_js_1.asyncHandler)(async (_req, res) => {
    const rankings = await analyticsService.getAreaRankings();
    res.json({ success: true, data: rankings });
}));
exports.analyticsRouter.get('/rankings/criminals', (0, async_handler_js_1.asyncHandler)(async (_req, res) => {
    const rankings = await analyticsService.getCriminalRankings();
    res.json({ success: true, data: rankings });
}));
exports.analyticsRouter.get('/rankings/philanthropists', (0, async_handler_js_1.asyncHandler)(async (_req, res) => {
    const rankings = await analyticsService.getPhilanthropistRankings();
    res.json({ success: true, data: rankings });
}));
exports.analyticsRouter.get('/social-radar', (0, async_handler_js_1.asyncHandler)(async (req, res) => {
    const interests = req.query.interests
        ?.split(',')
        .map((v) => v.trim())
        .filter(Boolean) || [];
    const lookingFor = req.query.lookingFor
        ?.split(',')
        .map((v) => v.trim())
        .filter(Boolean) || [];
    const matches = await analyticsService.getSocialRadarMatches(req.user.id, interests, lookingFor);
    res.json({ success: true, data: matches });
}));
//# sourceMappingURL=analytics.js.map