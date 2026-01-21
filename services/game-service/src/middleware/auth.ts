import jwt from 'jsonwebtoken';
import type { JwtPayload } from '@ludo/types';
import { prisma } from '@ludo/database';
import { logger } from '../utils/logger.js';

interface AuthUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

class AuthMiddleware {
  private getAccessSecret(): string {
    const secret = process.env.JWT_ACCESS_SECRET || 'dev-secret-change-in-production';
    return secret;
  }

  /**
   * Verify JWT token and return user data
   */
  async verifyToken(token: string): Promise<AuthUser | null> {
    try {
      const accessSecret = this.getAccessSecret();
      logger.debug({ tokenLength: token?.length, secretPrefix: accessSecret.substring(0, 10) }, 'Verifying token');
      const payload = jwt.verify(token, accessSecret) as JwtPayload;
      logger.debug({ sub: payload.sub, type: payload.type }, 'Token payload');

      if (payload.type !== 'access') {
        logger.warn('Token type is not access');
        return null;
      }

      // For development/testing, allow mock tokens
      if (process.env.NODE_ENV === 'development' && token.startsWith('dev_')) {
        const parts = token.split('_');
        return {
          id: parts[1] || 'dev-user',
          displayName: parts[2] || 'Developer',
          avatarUrl: null,
        };
      }

      // Fetch user from database
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
        },
      });

      if (!user) {
        logger.warn({ userId: payload.sub }, 'User not found in database');
        return null;
      }

      logger.debug({ userId: user.id }, 'User verified');
      return {
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      };
    } catch (error: any) {
      logger.warn({ error: error.message }, 'Token verification failed');
      return null;
    }
  }

  /**
   * Generate tokens for a user
   */
  generateTokens(
    userId: string,
    sessionId: string
  ): { accessToken: string; refreshToken: string; expiresIn: number } {
    const now = Math.floor(Date.now() / 1000);
    const accessExpiresIn = 900; // 15 minutes
    const refreshExpiresIn = 604800; // 7 days

    const accessPayload: JwtPayload = {
      sub: userId,
      type: 'access',
      iat: now,
      exp: now + accessExpiresIn,
      jti: crypto.randomUUID(),
      sessionId,
    };

    const refreshPayload: JwtPayload = {
      sub: userId,
      type: 'refresh',
      iat: now,
      exp: now + refreshExpiresIn,
      jti: crypto.randomUUID(),
      sessionId,
    };

    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';

    return {
      accessToken: jwt.sign(accessPayload, this.getAccessSecret()),
      refreshToken: jwt.sign(refreshPayload, refreshSecret),
      expiresIn: accessExpiresIn,
    };
  }
}

export const authMiddleware = new AuthMiddleware();
