import { Router, Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import passport from 'passport';
import { nanoid } from 'nanoid';
import { prisma } from '@ludo/database';
import type { JwtPayload, AuthTokens } from '@ludo/types';
import { logger } from '../utils/logger.js';

export const authRouter = Router();

const ACCESS_TOKEN_EXPIRY = 900; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 604800; // 7 days

// === Helper Functions ===

function getSecrets() {
  const accessSecret = process.env.JWT_ACCESS_SECRET || 'dev-secret';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
  // Debug log
  console.log('Using JWT Access Secret:', accessSecret.substring(0, 15) + '...');
  return { accessSecret, refreshSecret };
}

function generateTokens(userId: string, sessionId: string): AuthTokens {
  const { accessSecret, refreshSecret } = getSecrets();
  const now = Math.floor(Date.now() / 1000);

  const accessPayload: JwtPayload = {
    sub: userId,
    type: 'access',
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRY,
    jti: nanoid(),
    sessionId,
  };

  const refreshPayload: JwtPayload = {
    sub: userId,
    type: 'refresh',
    iat: now,
    exp: now + REFRESH_TOKEN_EXPIRY,
    jti: nanoid(),
    sessionId,
  };

  return {
    accessToken: jwt.sign(accessPayload, accessSecret),
    refreshToken: jwt.sign(refreshPayload, refreshSecret),
    expiresIn: ACCESS_TOKEN_EXPIRY,
  };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// === Validation Schemas ===

const guestLoginSchema = z.object({
  displayName: z.string().min(2).max(20).optional(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// === Routes ===

// Guest login - create anonymous user
authRouter.post('/guest', async (req: Request, res: Response) => {
  try {
    const body = guestLoginSchema.parse(req.body);
    const displayName = body.displayName || `Player${Math.floor(Math.random() * 10000)}`;

    // Create guest user
    const user = await prisma.user.create({
      data: {
        displayName,
        authProvider: 'guest',
        providerId: nanoid(),
        isGuest: true,
        stats: {
          create: {},
        },
      },
    });

    // Create session
    const sessionId = nanoid();
    const tokens = generateTokens(user.id, sessionId);

    await prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(tokens.refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000),
        deviceInfo: {
          userAgent: req.headers['user-agent'],
          ip: req.ip,
        },
      },
    });

    logger.info({ userId: user.id }, 'Guest user created');

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          isGuest: user.isGuest,
        },
        tokens,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error({ error }, 'Guest login failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google OAuth initiation
authRouter.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// Google OAuth callback
authRouter.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (!user) {
        return res.redirect('/login?error=auth_failed');
      }

      // Create session
      const sessionId = nanoid();
      const tokens = generateTokens(user.id, sessionId);

      await prisma.userSession.create({
        data: {
          userId: user.id,
          refreshTokenHash: hashToken(tokens.refreshToken),
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000),
          deviceInfo: {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
          },
        },
      });

      // Redirect to frontend with tokens
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(
        `${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`
      );
    } catch (error) {
      logger.error({ error }, 'Google callback failed');
      res.redirect('/login?error=auth_failed');
    }
  }
);

// Refresh token
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const body = refreshTokenSchema.parse(req.body);

    // Verify refresh token
    const { refreshSecret } = getSecrets();
    let payload: JwtPayload;
    try {
      payload = jwt.verify(body.refreshToken, refreshSecret) as JwtPayload;
    } catch {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (payload.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Find session
    const session = await prisma.userSession.findFirst({
      where: {
        userId: payload.sub,
        refreshTokenHash: hashToken(body.refreshToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session) {
      return res.status(401).json({ error: 'Session not found or expired' });
    }

    // Generate new tokens
    const newSessionId = nanoid();
    const tokens = generateTokens(session.userId, newSessionId);

    // Revoke old session and create new one
    await prisma.$transaction([
      prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      }),
      prisma.userSession.create({
        data: {
          userId: session.userId,
          refreshTokenHash: hashToken(tokens.refreshToken),
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000),
          deviceInfo: session.deviceInfo as any,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        tokens,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error({ error }, 'Token refresh failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.slice(7);
    const { accessSecret } = getSecrets();

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, accessSecret) as JwtPayload;
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Revoke all sessions for this user (optional: just revoke current session)
    await prisma.userSession.updateMany({
      where: {
        userId: payload.sub,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Logout failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.slice(7);
    const { accessSecret } = getSecrets();

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, accessSecret) as JwtPayload;
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { stats: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          isGuest: user.isGuest,
          createdAt: user.createdAt,
        },
        stats: user.stats,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Get user failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});
