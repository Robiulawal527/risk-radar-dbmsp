"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = requireRoles;
const types_1 = require("@risk-radar/types");
const http_error_js_1 = require("../lib/http-error.js");
function requireRoles(...roles) {
    return (req, _res, next) => {
        const userRole = req.user?.role || types_1.UserRole.USER;
        if (!roles.includes(userRole)) {
            return next(new http_error_js_1.HttpError(403, 'Insufficient permissions'));
        }
        next();
    };
}
//# sourceMappingURL=require-roles.js.map