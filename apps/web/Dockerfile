# Build from root to access all monorepo packages
FROM node:20-alpine AS builder

RUN npm install -g pnpm turbo

WORKDIR /app

# Copy everything (monorepo needs full context)
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build all dependencies using turbo (respects dependency order)
RUN pnpm turbo run build --filter=@ludo/web

# Production stage - serve static files
FROM node:20-alpine AS runner

RUN npm install -g serve

WORKDIR /app

# Copy built assets
COPY --from=builder /app/apps/web/dist ./dist

ENV PORT=3000
EXPOSE 3000

# Use shell form to expand $PORT
CMD serve -s dist -l $PORT
