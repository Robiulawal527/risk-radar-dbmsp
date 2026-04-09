const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { query } = require('../config/database');

let io;
const connectedUsers = new Map(); // userId -> socketId

const setupWebSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.userId}`);
    connectedUsers.set(socket.userId, socket.id);

    // Join user-specific room
    socket.join(`user:${socket.userId}`);

    // Join role-specific room
    socket.join(`role:${socket.userRole}`);

    // Handle location updates
    socket.on('location:update', async (data) => {
      try {
        const { latitude, longitude, accuracy } = data;
        
        // Save location to database
        await query(
          `INSERT INTO user_locations (user_id, latitude, longitude, accuracy, is_active)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (user_id) DO UPDATE 
           SET latitude = $2, longitude = $3, accuracy = $4, 
               timestamp = CURRENT_TIMESTAMP, is_active = true`,
          [socket.userId, latitude, longitude, accuracy || 10]
        );

        // Check for nearby high-risk areas
        const nearbyRisks = await checkNearbyRisks(latitude, longitude);
        
        if (nearbyRisks.length > 0) {
          socket.emit('risk:alert', {
            type: 'high_risk_zone',
            areas: nearbyRisks,
            message: 'You are entering a high-risk area. Stay alert!'
          });

          // Create notification in database
          for (const risk of nearbyRisks) {
            await createNotification({
              userId: socket.userId,
              type: 'risk_alert',
              title: 'High Risk Area Alert',
              message: `You are near ${risk.area_name} (Risk Score: ${risk.risk_score})`,
              severity: 'warning',
              relatedAreaId: risk.area_id
            });
          }
        }

        // Check for nearby crimes (within last 7 days, within 2km)
        const nearbyCrimes = await checkNearbyCrimes(latitude, longitude);
        
        if (nearbyCrimes.length > 0) {
          socket.emit('crime:nearby', {
            crimes: nearbyCrimes,
            count: nearbyCrimes.length
          });
        }

      } catch (error) {
        logger.error('Location update error:', error);
      }
    });

    // Handle emergency SOS
    socket.on('emergency:sos', async (data) => {
      try {
        const { latitude, longitude, emergencyType, message } = data;

        // Save SOS to database
        const result = await query(
          `INSERT INTO emergency_sos 
           (user_id, latitude, longitude, emergency_type, message, status)
           VALUES ($1, $2, $3, $4, $5, 'active')
           RETURNING id`,
          [socket.userId, latitude, longitude, emergencyType, message]
        );

        const sosId = result.rows[0].id;

        // Notify all police/admin users
        io.to('role:police').to('role:admin').emit('emergency:new', {
          id: sosId,
          userId: socket.userId,
          latitude,
          longitude,
          emergencyType,
          message,
          timestamp: new Date()
        });

        // Notify nearby users
        await notifyNearbyUsers(latitude, longitude, {
          type: 'emergency_nearby',
          message: 'Emergency situation reported nearby. Please be cautious.',
          distance: 2000 // 2km radius
        });

        socket.emit('emergency:confirmed', { sosId });
        
        logger.info(`SOS alert created: ${sosId} by user ${socket.userId}`);

      } catch (error) {
        logger.error('Emergency SOS error:', error);
        socket.emit('emergency:error', { message: 'Failed to send SOS' });
      }
    });

    // Handle crime report submission
    socket.on('crime:report', async (data) => {
      try {
        // Broadcast to admins/police for immediate attention
        io.to('role:admin').to('role:police').emit('crime:new_report', {
          ...data,
          reportedBy: socket.userId,
          timestamp: new Date()
        });
      } catch (error) {
        logger.error('Crime report broadcast error:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.userId}`);
      connectedUsers.delete(socket.userId);

      // Mark user location as inactive
      query(
        'UPDATE user_locations SET is_active = false WHERE user_id = $1',
        [socket.userId]
      ).catch(err => logger.error('Failed to update location status:', err));
    });
  });

  logger.info('✓ WebSocket server initialized');
  return io;
};

// Helper function to check nearby high-risk areas
async function checkNearbyRisks(latitude, longitude) {
  try {
    const result = await query(
      `SELECT 
        a.id as area_id,
        a.name_en as area_name,
        calculate_area_risk_score(a.id) as risk_score,
        ST_Distance(
          a.geom,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
        ) / 1000 as distance_km
      FROM areas a
      WHERE ST_DWithin(
        a.geom,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        2000
      )
      HAVING calculate_area_risk_score(a.id) >= 60
      ORDER BY distance_km
      LIMIT 5`,
      [latitude, longitude]
    );

    return result.rows;
  } catch (error) {
    logger.error('Check nearby risks error:', error);
    return [];
  }
}

// Helper function to check nearby crimes
async function checkNearbyCrimes(latitude, longitude) {
  try {
    const result = await query(
      `SELECT 
        ci.id,
        ci.crime_type_id,
        ct.name_en as crime_type,
        ci.severity,
        ci.incident_date,
        ST_Distance(
          ci.geom,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
        ) / 1000 as distance_km
      FROM crime_incidents ci
      JOIN crime_types ct ON ci.crime_type_id = ct.id
      WHERE ci.incident_date >= CURRENT_DATE - INTERVAL '7 days'
        AND ci.is_verified = true
        AND ci.is_public = true
        AND ST_DWithin(
          ci.geom,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
          2000
        )
      ORDER BY distance_km
      LIMIT 10`,
      [latitude, longitude]
    );

    return result.rows;
  } catch (error) {
    logger.error('Check nearby crimes error:', error);
    return [];
  }
}

// Helper function to notify nearby users
async function notifyNearbyUsers(latitude, longitude, notification) {
  try {
    const result = await query(
      `SELECT DISTINCT ul.user_id
       FROM user_locations ul
       WHERE ul.is_active = true
         AND ST_DWithin(
           ul.geom,
           ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
           $3
         )`,
      [latitude, longitude, notification.distance]
    );

    result.rows.forEach(row => {
      const socketId = connectedUsers.get(row.user_id);
      if (socketId) {
        io.to(`user:${row.user_id}`).emit('notification', notification);
      }
    });
  } catch (error) {
    logger.error('Notify nearby users error:', error);
  }
}

// Helper function to create notification in database
async function createNotification(data) {
  try {
    await query(
      `INSERT INTO notifications 
       (user_id, type, title, message, severity, related_area_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        data.userId,
        data.type,
        data.title,
        data.message,
        data.severity || 'info',
        data.relatedAreaId || null
      ]
    );
  } catch (error) {
    logger.error('Create notification error:', error);
  }
}

// Export function to emit events from outside
const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

const emitToRole = (role, event, data) => {
  if (io) {
    io.to(`role:${role}`).emit(event, data);
  }
};

const broadcastToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

module.exports = {
  setupWebSocket,
  emitToUser,
  emitToRole,
  broadcastToAll
};
