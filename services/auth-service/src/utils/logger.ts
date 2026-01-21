import pino from 'pino';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pinoLogger = (pino as any).default || pino;

export const logger = pinoLogger({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});
