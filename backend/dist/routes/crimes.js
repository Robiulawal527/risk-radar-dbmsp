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
exports.crimesRouter = void 0;
const express_1 = require("express");
const types_1 = require("@risk-radar/types");
const crimeService = __importStar(require("../services/crime.js"));
const async_handler_js_1 = require("../lib/async-handler.js");
const auth_js_1 = require("../middleware/auth.js");
const require_roles_js_1 = require("../middleware/require-roles.js");
exports.crimesRouter = (0, express_1.Router)();
exports.crimesRouter.get('/', (0, async_handler_js_1.asyncHandler)(async (req, res) => {
    const { page, limit, type, severity, area, district } = req.query;
    const crimes = await crimeService.findAll({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        type: type,
        severity: severity,
        area: area,
        district: district,
    });
    res.json({ success: true, data: crimes });
}));
exports.crimesRouter.get('/area/:area', auth_js_1.requireAuth, (0, async_handler_js_1.asyncHandler)(async (req, res) => {
    const crimes = await crimeService.findByArea(req.params.area);
    res.json({ success: true, data: crimes });
}));
exports.crimesRouter.get('/location/:lat/:lng', auth_js_1.requireAuth, (0, async_handler_js_1.asyncHandler)(async (req, res) => {
    const { lat, lng } = req.params;
    const radius = req.query.radius;
    const crimes = await crimeService.findByCoordinates(Number(lat), Number(lng), radius ? Number(radius) : undefined);
    res.json({ success: true, data: crimes });
}));
exports.crimesRouter.get('/:id', auth_js_1.requireAuth, (0, async_handler_js_1.asyncHandler)(async (req, res) => {
    const crime = await crimeService.findById(req.params.id);
    res.json({ success: true, data: crime });
}));
exports.crimesRouter.post('/', auth_js_1.requireAuth, (0, require_roles_js_1.requireRoles)(types_1.UserRole.ADMIN, types_1.UserRole.USER), (0, async_handler_js_1.asyncHandler)(async (req, res) => {
    const crime = await crimeService.create(req.body, req.user.id);
    res.json({ success: true, data: crime });
}));
exports.crimesRouter.put('/:id', auth_js_1.requireAuth, (0, require_roles_js_1.requireRoles)(types_1.UserRole.ADMIN), (0, async_handler_js_1.asyncHandler)(async (req, res) => {
    const crime = await crimeService.update(req.params.id, req.body);
    res.json({ success: true, data: crime });
}));
exports.crimesRouter.delete('/:id', auth_js_1.requireAuth, (0, require_roles_js_1.requireRoles)(types_1.UserRole.ADMIN), (0, async_handler_js_1.asyncHandler)(async (req, res) => {
    await crimeService.remove(req.params.id);
    res.json({ success: true });
}));
//# sourceMappingURL=crimes.js.map