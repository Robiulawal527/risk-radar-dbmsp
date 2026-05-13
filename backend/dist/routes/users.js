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
exports.usersRouter = void 0;
const express_1 = require("express");
const userService = __importStar(require("../services/user.js"));
const async_handler_js_1 = require("../lib/async-handler.js");
const auth_js_1 = require("../middleware/auth.js");
exports.usersRouter = (0, express_1.Router)();
exports.usersRouter.use(auth_js_1.requireAuth);
exports.usersRouter.get('/profile', (0, async_handler_js_1.asyncHandler)(async (req, res) => {
    res.json({ success: true, data: req.user });
}));
exports.usersRouter.put('/profile', (0, async_handler_js_1.asyncHandler)(async (req, res) => {
    const updated = await userService.updateProfile(req.user.id, req.body);
    res.json({ success: true, data: updated });
}));
exports.usersRouter.put('/password', (0, async_handler_js_1.asyncHandler)(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    await userService.changePassword(req.user.id, currentPassword, newPassword);
    res.json({ success: true });
}));
//# sourceMappingURL=users.js.map