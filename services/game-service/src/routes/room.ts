import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '@ludo/database';
import { authMiddleware } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

export const roomRouter: RouterType = Router();

// Request validation schemas
const createRoomSchema = z.object({
  isPrivate: z.boolean().optional().default(false),
  maxPlayers: z.number().min(2).max(4).optional().default(4),
});

const joinByCodeSchema = z.object({
  inviteCode: z.string().length(6),
});

// Auth middleware for routes
const authenticate = async (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7);
  const user = await authMiddleware.verifyToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  (req as any).user = user;
  next();
};

// Create a new room
roomRouter.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const body = createRoomSchema.parse(req.body);

    // Room creation is handled via WebSocket, this is just for REST API alternative
    // In production, you'd call RoomManager here

    res.json({
      success: true,
      data: {
        message: 'Use WebSocket to create rooms',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    logger.error({ error }, 'Failed to create room');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get public rooms
roomRouter.get('/public', async (req: Request, res: Response) => {
  try {
    // This would query Redis for active public rooms
    res.json({
      success: true,
      data: {
        rooms: [],
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get public rooms');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join room by invite code
roomRouter.post('/join', authenticate, async (req: Request, res: Response) => {
  try {
    const body = joinByCodeSchema.parse(req.body);

    // Room joining is handled via WebSocket
    res.json({
      success: true,
      data: {
        message: 'Use WebSocket to join rooms',
        inviteCode: body.inviteCode,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    logger.error({ error }, 'Failed to join room');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get room details
roomRouter.get('/:roomId', authenticate, async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    // This would query Redis for room data
    res.json({
      success: true,
      data: {
        roomId,
        message: 'Room data would be here',
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get room');
    res.status(500).json({ error: 'Internal server error' });
  }
});
