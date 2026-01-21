import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from service directory
dotenv.config({ path: join(__dirname, '..', '.env') });
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from '@ludo/database';
import { authRouter } from './routes/auth.js';
import { logger } from './utils/logger.js';

const PORT = process.env.AUTH_PORT || 3002;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

async function bootstrap() {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(passport.initialize());

  // Configure Google OAuth
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            // Find or create user
            let user = await prisma.user.findFirst({
              where: {
                authProvider: 'google',
                providerId: profile.id,
              },
            });

            if (!user) {
              user = await prisma.user.create({
                data: {
                  email: profile.emails?.[0]?.value,
                  displayName: profile.displayName || 'Player',
                  avatarUrl: profile.photos?.[0]?.value,
                  authProvider: 'google',
                  providerId: profile.id,
                  isGuest: false,
                  stats: {
                    create: {},
                  },
                },
              });
            }

            done(null, user);
          } catch (error) {
            done(error as Error);
          }
        }
      )
    );
  }

  // Routes
  app.use('/api/auth', authRouter);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'auth-service' });
  });

  // Start server
  app.listen(PORT, () => {
    logger.info(`Auth service running on port ${PORT}`);
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to start auth service', error);
  process.exit(1);
});
