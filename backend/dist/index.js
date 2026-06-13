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
const http_1 = require("http");
const socket_io_1 = require("socket.io");
require("@risk-radar/config");
const database_1 = require("@risk-radar/database");
const config_1 = require("@risk-radar/config");
const app_js_1 = require("./app.js");
const sosService = __importStar(require("./services/sos.js"));
/** Boots the Express API and Socket.IO bridge, then reports database reachability. */
async function main() {
    database_1.pool
        .query('SELECT 1')
        .then(() => {
        console.log('✅ Database connected');
    })
        .catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.warn(`⚠️ Database connection check failed: ${message}`);
    });
    const app = (0, app_js_1.createApp)();
    const httpServer = (0, http_1.createServer)(app);
    const io = new socket_io_1.Server(httpServer, {
        cors: { origin: true, credentials: true },
    });
    io.on('connection', (socket) => {
        // Clients can optionally join a room for their current area/district to reduce noise for 50+ users.
        // Example from client: socket.emit('join-area', { area: 'Dhanmondi' });
        socket.on('join-area', (payload) => {
            const room = payload.area || payload.district;
            if (room) {
                socket.join(room);
            }
            // Also keep a general room
            socket.join('global');
        });
        socket.on('sos:create', async (data, callback) => {
            try {
                const sosRequest = await sosService.createSOSRequest(data.userId, data.location, data.message);
                // Broadcast to everyone (backwards compatible) + targeted room if we have area info
                io.emit('sos:alert', sosRequest);
                const area = sosRequest?.location?.area || sosRequest?.area;
                const district = sosRequest?.location?.district;
                if (area)
                    io.to(area).emit('sos:alert', sosRequest);
                if (district)
                    io.to(district).emit('sos:alert', sosRequest);
                io.to('global').emit('sos:alert', sosRequest);
                callback?.({ success: true, data: sosRequest });
            }
            catch (e) {
                const message = e instanceof Error ? e.message : 'Unknown error';
                callback?.({ success: false, error: message });
            }
        });
        socket.on('sos:update', async (data, callback) => {
            try {
                const sosRequest = await sosService.updateSOSStatus(data.id, data.userId, data.status);
                io.emit('sos:updated', sosRequest);
                const area = sosRequest?.location?.area;
                const district = sosRequest?.location?.district;
                if (area)
                    io.to(area).emit('sos:updated', sosRequest);
                if (district)
                    io.to(district).emit('sos:updated', sosRequest);
                callback?.({ success: true, data: sosRequest });
            }
            catch (e) {
                const message = e instanceof Error ? e.message : 'Unknown error';
                callback?.({ success: false, error: message });
            }
        });
    });
    const port = Number(process.env.PORT || config_1.config.port) || 3001;
    httpServer.listen(port, () => {
        console.log(`🚀 Backend server running on http://localhost:${port}`);
        console.log(`📡 API available at http://localhost:${port}/api`);
        console.log(`🔌 WebSocket server running on ws://localhost:${port}`);
    });
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=index.js.map