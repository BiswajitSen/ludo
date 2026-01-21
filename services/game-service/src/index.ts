import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from service directory
dotenv.config({ path: join(__dirname, '..', '.env') });
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@ludo/types';
import { logger } from './utils/logger.js';
import { RedisService } from './services/RedisService.js';
import { RoomManager } from './services/RoomManager.js';
import { GameGateway } from './gateway/GameGateway.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware, RATE_LIMITS } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { roomRouter } from './routes/room.js';

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

async function bootstrap() {
  // Initialize Express
  const app = express();
  const httpServer = createServer(app);

  // Middleware
  app.use(helmet());
  app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
  app.use(express.json());

  // Routes
  app.use('/health', healthRouter);
  app.use('/api/rooms', rateLimitMiddleware(RATE_LIMITS.api), roomRouter);

  // Error handling (must be after routes)
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Initialize Redis
  const redis = new RedisService();
  await redis.connect();
  logger.info('Redis connected');

  // Initialize Socket.IO
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: '/ws',
    cors: {
      origin: CORS_ORIGIN,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Initialize Room Manager
  const roomManager = new RoomManager(redis);

  // Initialize Game Gateway (WebSocket handlers)
  const gameGateway = new GameGateway(io, redis, roomManager);
  gameGateway.initialize();

  // Socket.IO authentication middleware
  io.use(async (socket, next) => {
    logger.info({ socketId: socket.id }, 'Socket connection attempt');
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        logger.warn({ socketId: socket.id }, 'No auth token provided');
        return next(new Error('Authentication required'));
      }

      const user = await authMiddleware.verifyToken(token);
      if (!user) {
        logger.warn({ socketId: socket.id }, 'Invalid token');
        return next(new Error('Invalid token'));
      }

      logger.info({ socketId: socket.id, userId: user.id }, 'Socket authenticated');
      socket.data.user = user;
      next();
    } catch (error) {
      logger.error({ socketId: socket.id, error }, 'Socket auth error');
      next(new Error('Authentication failed'));
    }
  });

  // Start server
  httpServer.listen(PORT, () => {
    logger.info(`Game service running on port ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    
    io.close();
    await redis.disconnect();
    
    httpServer.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
