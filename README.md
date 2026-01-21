# Ludo Multiplayer - Production-Grade Online Board Game

A real-time multiplayer Ludo game with voice chat, built with React, Node.js, WebSockets, and WebRTC.

## Features

- **Real-time Multiplayer**: 2-4 players per game with WebSocket-based communication
- **Voice Chat**: Built-in voice chat using WebRTC (LiveKit SFU)
- **Server-Authoritative**: Anti-cheat measures with server-side game logic
- **Reconnection Support**: Players can reconnect to ongoing games
- **Modern UI**: Beautiful, responsive design with Tailwind CSS and Framer Motion

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Framer Motion for animations
- Socket.IO client for WebSocket
- LiveKit client for voice chat
- Zustand for state management

### Backend
- Node.js with TypeScript
- Express + Socket.IO for WebSocket server
- PostgreSQL with Prisma ORM
- Redis for pub/sub, room state, and caching
- LiveKit for voice server (SFU)
- JWT for authentication

### Infrastructure
- Docker & Docker Compose for development
- Kubernetes for production deployment
- Nginx for static serving and reverse proxy

## Project Structure

```
ludo/
├── apps/
│   └── web/                    # React frontend
├── packages/
│   ├── types/                  # Shared TypeScript types
│   ├── game-engine/            # Core Ludo game logic
│   └── database/               # Prisma schema and client
├── services/
│   ├── auth-service/           # Authentication service
│   └── game-service/           # Game server with WebSocket
├── docker/                     # Docker configurations
└── k8s/                        # Kubernetes manifests
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose
- PostgreSQL 16+
- Redis 7+

### Development Setup

1. **Clone and install dependencies**
   ```bash
   git clone <repo>
   cd ludo
   pnpm install
   ```

2. **Start infrastructure services**
   ```bash
   pnpm docker:dev
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

4. **Generate Prisma client and push schema**
   ```bash
   pnpm db:generate
   pnpm db:push
   ```

5. **Start development servers**
   ```bash
   pnpm dev
   ```

   This starts:
   - Frontend: http://localhost:5173
   - Game Service: http://localhost:3001
   - Auth Service: http://localhost:3002

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_HOST` | Redis host | localhost |
| `REDIS_PORT` | Redis port | 6379 |
| `JWT_ACCESS_SECRET` | JWT signing secret (min 32 chars) | - |
| `JWT_REFRESH_SECRET` | Refresh token secret (min 32 chars) | - |
| `LIVEKIT_API_KEY` | LiveKit API key | - |
| `LIVEKIT_API_SECRET` | LiveKit API secret | - |
| `LIVEKIT_WS_URL` | LiveKit WebSocket URL | - |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | - |

## Game Rules

1. Each player has 4 tokens that start in their "yard"
2. Roll a 6 to bring a token out of the yard
3. Move tokens clockwise around the board based on dice rolls
4. Land on opponent's token to capture it (send back to yard)
5. Safe zones protect tokens from capture
6. First player to get all 4 tokens home wins
7. Rolling a 6 or capturing gives you an extra turn

## WebSocket Events

### Client → Server
- `room:join` - Join a game room
- `room:leave` - Leave current room
- `room:ready` - Toggle ready status
- `room:start` - Start the game (host only)
- `game:roll` - Roll the dice
- `game:move` - Move a token

### Server → Client
- `room:joined` - Successfully joined room
- `room:playerJoined` - New player joined
- `room:playerLeft` - Player left room
- `game:started` - Game has started
- `game:turnStart` - Turn started for a player
- `game:diceResult` - Dice roll result
- `game:moveExecuted` - Token move executed
- `game:ended` - Game finished

## Production Deployment

### Build Docker Images

```bash
# Game service
docker build -f docker/Dockerfile.game-service -t ludo-game-service .

# Web app
docker build -f docker/Dockerfile.web -t ludo-web .
```

### Deploy to Kubernetes

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Apply configs and secrets
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml

# Deploy services
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/game-service.yaml
kubectl apply -f k8s/web.yaml
kubectl apply -f k8s/ingress.yaml
```

### Scaling

The game service automatically scales based on CPU/memory usage:
- Min replicas: 3
- Max replicas: 20
- Scale up at 70% CPU or 80% memory

## Voice Chat Setup

### Using LiveKit Cloud (Recommended)
1. Sign up at https://livekit.io
2. Create a project
3. Copy API key and secret to environment variables

### Self-Hosted LiveKit
1. Deploy LiveKit server using the provided docker-compose
2. Configure TURN server for NAT traversal
3. Update environment variables

## Security Measures

- **Server-Authoritative Logic**: All game state validated server-side
- **Cryptographic Dice**: Secure random number generation
- **JWT Authentication**: Short-lived access tokens (15 min)
- **Rate Limiting**: Per-action rate limits
- **Input Validation**: Zod schema validation on all inputs
- **Reconnection Tokens**: Secure, time-limited reconnection

## Monitoring

### Health Endpoints
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check
- `GET /health/live` - Liveness check

### Metrics (Coming Soon)
- Prometheus metrics at `/metrics`
- Active games, players, latency metrics

## License

MIT
