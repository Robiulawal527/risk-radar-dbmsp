import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';
import '@risk-radar/config';
import { pool } from '@risk-radar/database';
import { config } from '@risk-radar/config';
import { SOSStatus } from '@risk-radar/types';
import { createApp } from './app.js';
import * as sosService from './services/sos.js';

/** Boots the Express API and Socket.IO bridge after confirming the database is reachable. */
async function main() {
  await pool.query('SELECT 1');
  console.log('✅ Database connected');

  const app = createApp();
  const httpServer = createServer(app);
  const io = new IOServer(httpServer, {
    cors: { origin: true, credentials: true },
  });

  io.on('connection', (socket) => {
    socket.on(
      'sos:create',
      async (
        data: { userId: string; location: Parameters<typeof sosService.createSOSRequest>[1]; message?: string },
        callback?: (r: unknown) => void
      ) => {
        try {
          const sosRequest = await sosService.createSOSRequest(data.userId, data.location, data.message);
          io.emit('sos:alert', sosRequest);
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
