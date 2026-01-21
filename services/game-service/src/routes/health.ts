import { Router } from 'express';
import type { Router as RouterType } from 'express';

export const healthRouter: RouterType = Router();

healthRouter.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'game-service',
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/ready', (req, res) => {
  // Add checks for dependencies (Redis, DB) here
  res.json({
    status: 'ready',
    checks: {
      redis: 'ok',
      database: 'ok',
    },
  });
});

healthRouter.get('/live', (req, res) => {
  res.json({ status: 'live' });
});
