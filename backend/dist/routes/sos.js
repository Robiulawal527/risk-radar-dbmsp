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
exports.sosRouter = void 0;
const express_1 = require("express");
const types_1 = require("@risk-radar/types");
const sosService = __importStar(require("../services/sos.js"));
const async_handler_js_1 = require("../lib/async-handler.js");
const auth_js_1 = require("../middleware/auth.js");
exports.sosRouter = (0, express_1.Router)();
exports.sosRouter.use(auth_js_1.requireAuth);
// Returns every active SOS so maps and realtime dashboards can show only unresolved emergencies.
exports.sosRouter.get('/active', (0, async_handler_js_1.asyncHandler)(async (_req, res) => {
    const requests = await sosService.getActiveSOSRequests();
    res.json({ success: true, data: requests });
}));
// Returns the signed-in user's SOS history, including resolved alerts for accountability.
exports.sosRouter.get('/user', (0, async_handler_js_1.asyncHandler)(async (req, res) => {
    const requests = await sosService.getUserSOSRequests(req.user.id);
    res.json({ success: true, data: requests });
}));
// Creates a new active SOS using the authenticated user id rather than trusting client-supplied ownership.
exports.sosRouter.post('/', (0, async_handler_js_1.asyncHandler)(async (req, res) => {
    const { location, message } = req.body;
    const sosRequest = await sosService.createSOSRequest(req.user.id, location, message);
    res.json({ success: true, data: sosRequest });
}));
// Updates status for an owned SOS row; ownership is enforced in the service query.
exports.sosRouter.put('/:id/status', (0, async_handler_js_1.asyncHandler)(async (req, res) => {
    const sosRequest = await sosService.updateSOSStatus(req.params.id, req.user.id, req.body.status);
    res.json({ success: true, data: sosRequest });
}));
// Soft-deletes an owned SOS by resolving it, which removes it from active feeds without destroying history.
exports.sosRouter.delete('/:id', (0, async_handler_js_1.asyncHandler)(async (req, res) => {
    const sosRequest = await sosService.resolveSOSRequest(req.params.id, req.user.id);
    res.json({
        success: true,
        data: sosRequest,
        message: sosRequest.status === types_1.SOSStatus.RESOLVED ? 'SOS resolved' : 'SOS updated',
    });
}));
//# sourceMappingURL=sos.js.map