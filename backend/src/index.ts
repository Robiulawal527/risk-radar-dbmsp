import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';
import '@risk-radar/config';
import { pool } from '@risk-radar/database';
import { config } from '@risk-radar/config';
import { SOSStatus } from '@risk-radar/types';
import { createApp } from './app.js';
import * as sosService from './services/sos.js';

/** Boots the Express API and Socket.IO bridge, then reports database reachability. */
async function main() {
  pool
    .query('SELECT 1')
    .then(() => {
      console.log('✅ Database connected');
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      console.warn(`⚠️ Database connection check failed: ${message}`);
    });

  const app = createApp();
  const httpServer = createServer(app);
  const io = new IOServer(httpServer, {
    cors: { origin: true, credentials: true },
  });

  io.on('connection', (socket) => {
    // Clients can optionally join a room for their current area/district to reduce noise for 50+ users.
    // Example from client: socket.emit('join-area', { area: 'Dhanmondi' });
    socket.on('join-area', (payload: { area?: string; district?: string }) => {
      const room = payload.area || payload.district;
      if (room) {
        socket.join(room);
      }
      // Also keep a general room
      socket.join('global');
    });

    socket.on(
      'sos:create',
      async (
        data: {
          userId: string;
          location: Parameters<typeof sosService.createSOSRequest>[1];
          message?: string;
        },
        callback?: (r: unknown) => void
      ) => {
        try {
          const sosRequest = await sosService.createSOSRequest(data.userId, data.location, data.message);

          // Broadcast to everyone (backwards compatible) + targeted room if we have area info
          io.emit('sos:alert', sosRequest);

          const area = (sosRequest as any)?.location?.area || (sosRequest as any)?.area;
          const district = (sosRequest as any)?.location?.district;
          if (area) io.to(area).emit('sos:alert', sosRequest);
          if (district) io.to(district).emit('sos:alert', sosRequest);
          io.to('global').emit('sos:alert', sosRequest);

          callback?.({ success: true, data: sosRequest });
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'Unknown error';
          callback?.({ success: false, error: message });
        }
      }
    );

    socket.on(
      'sos:update',
      async (data: { id: string; userId: string; status: SOSStatus }, callback?: (r: unknown) => void) => {
        try {
          const sosRequest = await sosService.updateSOSStatus(data.id, data.userId, data.status);
          io.emit('sos:updated', sosRequest);

          const area = (sosRequest as any)?.location?.area;
          const district = (sosRequest as any)?.location?.district;
          if (area) io.to(area).emit('sos:updated', sosRequest);
          if (district) io.to(district).emit('sos:updated', sosRequest);

          callback?.({ success: true, data: sosRequest });
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'Unknown error';
          callback?.({ success: false, error: message });
        }
      }
    );
  });

  const port = Number(process.env.PORT || config.port) || 3001;
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
