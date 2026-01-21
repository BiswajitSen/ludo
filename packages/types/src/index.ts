// ===========================================
// User & Auth Types
// ===========================================

export interface User {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  authProvider: 'guest' | 'google';
  isGuest: boolean;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
  jti: string;
  sessionId: string;
}

// ===========================================
// Game Types
// ===========================================

export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow';

export type GamePhase = 'waiting' | 'playing' | 'finished';

export type TurnPhase = 'rolling' | 'moving' | 'waiting';

export interface TokenPosition {
  tokenId: number;
  position: number; // -1 = yard, 0-51 = main track, 100-105 = home stretch, 106 = home
  isHome: boolean;
}

export interface Player {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  color: PlayerColor;
  status: 'connected' | 'disconnected';
  tokens: TokenPosition[];
  tokensHome: number;
}

export interface GameState {
  roomId: string;
  gameId: string;
  phase: GamePhase;
  turnPhase: TurnPhase;
  players: Player[];
  playerOrder: string[];
  currentTurn: string | null;
  turnNumber: number;
  diceValue: number | null;
  validMoves: number[];
  lastMoveAt: number | null;
  startedAt: number | null;
  endedAt: number | null;
  winner: string | null;
}

export interface MoveResult {
  valid: boolean;
  tokenId: number;
  fromPosition: number;
  toPosition: number;
  captures: CaptureInfo[];
  bonusTurn: boolean;
  gameWon: boolean;
  reason?: string;
}

export interface CaptureInfo {
  playerId: string;
  tokenId: number;
  position: number;
}

// ===========================================
// Room Types
// ===========================================

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Room {
  id: string;
  status: RoomStatus;
  hostId: string;
  isPrivate: boolean;
  inviteCode: string;
  maxPlayers: number;
  players: RoomPlayer[];
  createdAt: number;
  gameServerId: string | null;
}

export interface RoomPlayer {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  color: PlayerColor | null;
  isHost: boolean;
  isReady: boolean;
  joinedAt: number;
}

// ===========================================
// WebSocket Events - Client to Server
// ===========================================

export interface ClientToServerEvents {
  // Room events
  'room:create': (data: { isPrivate?: boolean }) => void;
  'room:join': (data: { roomId: string; rejoinToken?: string }) => void;
  'room:leave': (data: { roomId: string }) => void;
  'room:ready': (data: { roomId: string; ready: boolean }) => void;
  'room:start': (data: { roomId: string }) => void;
  'room:kick': (data: { roomId: string; playerId: string }) => void;

  // Game events
  'game:roll': (data: { roomId: string; timestamp: number }) => void;
  'game:move': (data: {
    roomId: string;
    tokenId: number;
    moveSequence: number;
  }) => void;

  // Chat events
  'chat:message': (data: {
    roomId: string;
    message: string;
    type: 'text' | 'emoji' | 'quickChat';
  }) => void;

  // Presence
  pong: () => void;
}

// ===========================================
// WebSocket Events - Server to Client
// ===========================================

export interface ServerToClientEvents {
  // Connection
  'connection:established': (data: { playerId: string }) => void;
  'connection:error': (data: { code: string; message: string }) => void;

  // Room events
  'room:joined': (data: {
    room: Room;
    gameState: GameState | null;
    voiceToken: string;
    voiceServerUrl: string;
    yourPlayerId: string;
    rejoinToken: string;
  }) => void;
  'room:playerJoined': (data: { player: RoomPlayer }) => void;
  'room:playerLeft': (data: {
    playerId: string;
    reason: 'left' | 'disconnected' | 'kicked';
    canReconnect: boolean;
    reconnectDeadline?: number;
  }) => void;
  'room:playerReconnected': (data: { playerId: string }) => void;
  'room:playerReady': (data: { playerId: string; ready: boolean }) => void;
  'room:hostChanged': (data: { newHostId: string }) => void;
  'room:closed': (data: { reason: string }) => void;

  // Game events
  'game:started': (data: {
    gameId: string;
    gameState: GameState;
  }) => void;
  'game:turnStart': (data: {
    playerId: string;
    turnNumber: number;
    duration: number;
    serverTime: number;
  }) => void;
  'game:diceResult': (data: {
    playerId: string;
    value: number;
    validMoves: number[];
    turnId: string;
  }) => void;
  'game:moveExecuted': (data: {
    playerId: string;
    tokenId: number;
    fromPosition: number;
    toPosition: number;
    captures: CaptureInfo[];
    bonusTurn: boolean;
    boardState: Player[];
    moveId: string;
  }) => void;
  'game:turnTimeout': (data: {
    playerId: string;
    consecutiveTimeouts: number;
  }) => void;
  'game:turnWarning': (data: {
    playerId: string;
    remainingMs: number;
  }) => void;
  'game:ended': (data: {
    winner: string;
    rankings: PlayerRanking[];
    matchId: string;
  }) => void;

  // Chat events
  'chat:message': (data: {
    playerId: string;
    displayName: string;
    message: string;
    type: 'text' | 'emoji' | 'quickChat';
    timestamp: number;
  }) => void;

  // Presence
  ping: () => void;

  // Errors
  error: (data: GameError) => void;
}

export interface PlayerRanking {
  playerId: string;
  displayName: string;
  position: number;
  tokensHome: number;
  tokensCaptured: number;
  ratingChange?: number;
}

export interface GameError {
  code: GameErrorCode;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
}

export type GameErrorCode =
  | 'INVALID_MOVE'
  | 'NOT_YOUR_TURN'
  | 'GAME_NOT_STARTED'
  | 'ROOM_FULL'
  | 'ROOM_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INVALID_STATE'
  | 'RECONNECT_EXPIRED'
  | 'UNAUTHORIZED'
  | 'INTERNAL_ERROR';

// ===========================================
// Matchmaking Types
// ===========================================

export type MatchmakingMode = 'ranked' | 'casual' | 'private';

export interface MatchmakingRequest {
  playerId: string;
  mode: MatchmakingMode;
  playerCount?: 2 | 3 | 4;
  skillRating?: number;
}

export interface MatchmakingResult {
  status: 'queued' | 'matched' | 'cancelled';
  roomId?: string;
  estimatedWait?: number;
  position?: number;
}

// ===========================================
// Stats Types
// ===========================================

export interface PlayerStats {
  userId: string;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  winRate: number;
  tokensCaptured: number;
  tokensLost: number;
  skillRating: number;
  bestWinStreak: number;
  currentWinStreak: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  skillRating: number;
  gamesWon: number;
  gamesPlayed: number;
}

// ===========================================
// API Response Types
// ===========================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
