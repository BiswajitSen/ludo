# Build from root to access all monorepo packages
FROM node:20-alpine AS builder

RUN npm install -g pnpm turbo

WORKDIR /app

# Copy everything (monorepo needs full context)
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm --filter @ludo/database exec prisma generate || true

# Build all dependencies using turbo (respects dependency order)
RUN pnpm turbo run build --filter=@ludo/game-service

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy package files
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./

# Copy built packages
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/game-engine/dist ./packages/game-engine/dist
COPY --from=builder /app/packages/game-engine/package.json ./packages/game-engine/
COPY --from=builder /app/packages/database ./packages/database

# Copy built service
COPY --from=builder /app/services/game-service/dist ./services/game-service/dist
COPY --from=builder /app/services/game-service/package.json ./services/game-service/

# Copy node_modules
COPY --from=builder /app/node_modules ./node_modules

WORKDIR /app/services/game-service

ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/index.js"]
