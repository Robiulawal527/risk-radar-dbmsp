"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationType = exports.UserRole = exports.SOSStatus = exports.Severity = exports.CrimeType = void 0;
var CrimeType;
(function (CrimeType) {
    CrimeType["THEFT"] = "THEFT";
    CrimeType["ROBBERY"] = "ROBBERY";
    CrimeType["ASSAULT"] = "ASSAULT";
    CrimeType["BURGLARY"] = "BURGLARY";
    CrimeType["FRAUD"] = "FRAUD";
    CrimeType["VANDALISM"] = "VANDALISM";
    CrimeType["HARASSMENT"] = "HARASSMENT";
    CrimeType["OTHER"] = "OTHER";
})(CrimeType || (exports.CrimeType = CrimeType = {}));
var Severity;
(function (Severity) {
    Severity["LOW"] = "LOW";
    Severity["MEDIUM"] = "MEDIUM";
    Severity["HIGH"] = "HIGH";
    Severity["CRITICAL"] = "CRITICAL";
})(Severity || (exports.Severity = Severity = {}));
var SOSStatus;
(function (SOSStatus) {
    SOSStatus["ACTIVE"] = "ACTIVE";
    SOSStatus["RESOLVED"] = "RESOLVED";
    SOSStatus["CANCELLED"] = "CANCELLED";
})(SOSStatus || (exports.SOSStatus = SOSStatus = {}));
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "USER";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (exports.UserRole = UserRole = {}));
var NotificationType;
(function (NotificationType) {
    NotificationType["CRIME_ALERT"] = "CRIME_ALERT";
    NotificationType["SOS_UPDATE"] = "SOS_UPDATE";
    NotificationType["SYSTEM"] = "SYSTEM";
    NotificationType["COMMUNITY"] = "COMMUNITY";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
