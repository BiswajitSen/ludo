import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Simple in-memory rate limiter
 * For production, use Redis-based rate limiting
 */
class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  check(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetTime < now) {
      // New window
      this.store.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs,
      };
    }

    if (entry.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

const rateLimiter = new RateLimiter();

/**
 * Rate limit configurations for different actions
 */
export const RATE_LIMITS = {
  // API endpoints
  api: { windowMs: 60000, maxRequests: 100 }, // 100 requests per minute
  auth: { windowMs: 300000, maxRequests: 10 }, // 10 auth attempts per 5 minutes
  roomCreate: { windowMs: 60000, maxRequests: 5 }, // 5 room creates per minute

  // Game actions (per socket)
  diceRoll: { windowMs: 1000, maxRequests: 2 }, // 2 rolls per second
  move: { windowMs: 1000, maxRequests: 3 }, // 3 moves per second
  chat: { windowMs: 10000, maxRequests: 10 }, // 10 messages per 10 seconds
};

/**
 * Express middleware for HTTP rate limiting
 */
export function rateLimitMiddleware(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `http:${req.ip}:${req.path}`;
    const result = rateLimiter.check(key, config);

    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

    if (!result.allowed) {
      logger.warn({ ip: req.ip, path: req.path }, 'Rate limit exceeded');
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      });
    }

    next();
  };
}

/**
 * Socket.IO rate limiting helper
 */
export function checkSocketRateLimit(
  socketId: string,
  action: keyof typeof RATE_LIMITS
): { allowed: boolean; retryAfter?: number } {
  const config = RATE_LIMITS[action];
  const key = `socket:${socketId}:${action}`;
  const result = rateLimiter.check(key, config);

  if (!result.allowed) {
    logger.warn({ socketId, action }, 'Socket rate limit exceeded');
    return {
      allowed: false,
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
    };
  }

  return { allowed: true };
}

export { rateLimiter };
