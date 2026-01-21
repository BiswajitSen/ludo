import { nanoid } from 'nanoid';
import type { Room, RoomPlayer, PlayerColor, GameState } from '@ludo/types';
import { LudoEngine } from '@ludo/game-engine';
import { RedisService } from './RedisService.js';
import { logger } from '../utils/logger.js';

const PLAYER_COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow'];

export class RoomManager {
  private redis: RedisService;
  private activeGames: Map<string, LudoEngine> = new Map();

  constructor(redis: RedisService) {
    this.redis = redis;
  }

  /**
   * Create a new game room
   */
  async createRoom(
    hostId: string,
    hostName: string,
    hostAvatar: string | null,
    options: { isPrivate?: boolean; maxPlayers?: number } = {}
  ): Promise<Room> {
    const roomId = nanoid(10);
    const inviteCode = this.generateInviteCode();

    const room: Room = {
      id: roomId,
      status: 'waiting',
      hostId,
      isPrivate: options.isPrivate ?? false,
      inviteCode,
      maxPlayers: options.maxPlayers ?? 4,
      players: [],
      createdAt: Date.now(),
      gameServerId: process.env.SERVER_ID || 'local',
    };

    await this.redis.createRoom(room);

    // Add host as first player
    const hostPlayer: RoomPlayer = {
      id: hostId,
      displayName: hostName,
      avatarUrl: hostAvatar,
      color: PLAYER_COLORS[0],
      isHost: true,
      isReady: false,
      joinedAt: Date.now(),
    };

    await this.redis.addRoomPlayer(roomId, hostPlayer);
    room.players.push(hostPlayer);

    logger.info({ roomId, hostId }, 'Room created');
    return room;
  }

  /**
   * Join an existing room by room ID or invite code
   */
  async joinRoom(
    roomIdOrCode: string,
    playerId: string,
    playerName: string,
    playerAvatar: string | null
  ): Promise<{ room: Room; player: RoomPlayer } | { error: string }> {
    // First try to find room by ID
    let room = await this.redis.getRoom(roomIdOrCode);
    let roomId = roomIdOrCode;

    // If not found, try to find by invite code
    if (!room) {
      const foundRoomId = await this.redis.findRoomByInviteCode(roomIdOrCode.toUpperCase());
      if (foundRoomId) {
        room = await this.redis.getRoom(foundRoomId);
        roomId = foundRoomId;
      }
    }

    if (!room) {
      logger.warn({ roomIdOrCode }, 'Room not found');
      return { error: 'Room not found' };
    }

    // Check if already in room - allow rejoin even if game in progress
    const existing = room.players.find((p) => p.id === playerId);
    if (existing) {
      return { room, player: existing };
    }

    // New players can only join waiting rooms
    if (room.status !== 'waiting') {
      return { error: 'Game already in progress' };
    }

    if (room.players.length >= room.maxPlayers) {
      return { error: 'Room is full' };
    }

    // Assign next available color
    const usedColors = new Set(room.players.map((p) => p.color));
    const availableColor = PLAYER_COLORS.find((c) => !usedColors.has(c));

    if (!availableColor) {
      return { error: 'No available colors' };
    }

    const player: RoomPlayer = {
      id: playerId,
      displayName: playerName,
      avatarUrl: playerAvatar,
      color: availableColor,
      isHost: false,
      isReady: false,
      joinedAt: Date.now(),
    };

    await this.redis.addRoomPlayer(roomId, player);

    const updatedRoom = await this.redis.getRoom(roomId);
    logger.info({ roomId, playerId }, 'Player joined room');

    return { room: updatedRoom!, player };
  }

  /**
   * Leave a room
   */
  async leaveRoom(
    roomId: string,
    playerId: string
  ): Promise<{ newHost?: string; roomClosed?: boolean }> {
    const room = await this.redis.getRoom(roomId);
    if (!room) {
      return { roomClosed: true };
    }

    await this.redis.removeRoomPlayer(roomId, playerId);

    const remainingPlayers = room.players.filter((p) => p.id !== playerId);

    if (remainingPlayers.length === 0) {
      // Close room if empty
      await this.redis.deleteRoom(roomId);
      this.activeGames.delete(roomId);
      logger.info({ roomId }, 'Room closed (empty)');
      return { roomClosed: true };
    }

    // Transfer host if host left
    if (room.hostId === playerId) {
      const newHost = remainingPlayers[0];
      await this.redis.updateRoomPlayer(roomId, newHost.id, { isHost: true });
      await this.redis.client?.hset(`room:${roomId}`, 'hostId', newHost.id);
      logger.info({ roomId, newHostId: newHost.id }, 'Host transferred');
      return { newHost: newHost.id };
    }

    return {};
  }

  /**
   * Set player ready status
   */
  async setPlayerReady(
    roomId: string,
    playerId: string,
    ready: boolean
  ): Promise<boolean> {
    await this.redis.updateRoomPlayer(roomId, playerId, { isReady: ready });
    return true;
  }

  /**
   * Start the game
   */
  async startGame(roomId: string, hostId: string): Promise<GameState | { error: string }> {
    const room = await this.redis.getRoom(roomId);

    if (!room) {
      return { error: 'Room not found' };
    }

    if (room.hostId !== hostId) {
      return { error: 'Only host can start the game' };
    }

    if (room.players.length < 2) {
      return { error: 'Need at least 2 players' };
    }

    // Check if all players are ready (except host)
    const notReady = room.players.filter((p) => !p.isHost && !p.isReady);
    if (notReady.length > 0) {
      return { error: 'Not all players are ready' };
    }

    // Create game engine
    const engine = new LudoEngine({ roomId });

    // Add all players to the engine
    for (const player of room.players) {
      engine.addPlayer(player.id, player.displayName, player.avatarUrl);
    }

    // Store engine BEFORE starting so event listeners can be attached
    this.activeGames.set(roomId, engine);
    await this.redis.updateRoomStatus(roomId, 'playing');

    // Start the game (this will emit turnStart event)
    const gameState = engine.startGame();
    if (!gameState) {
      this.activeGames.delete(roomId);
      return { error: 'Failed to start game' };
    }

    // Save state after game started
    await this.redis.setGameState(roomId, gameState);

    logger.info({ roomId, playerCount: room.players.length }, 'Game started');
    return gameState;
  }

  /**
   * Get the game engine for a room
   */
  getGameEngine(roomId: string): LudoEngine | undefined {
    return this.activeGames.get(roomId);
  }

  /**
   * Restore game engine from Redis state (for reconnection)
   */
  async restoreGameEngine(roomId: string): Promise<LudoEngine | null> {
    const gameState = await this.redis.getGameState(roomId);
    if (!gameState || gameState.phase !== 'playing') {
      return null;
    }

    // Create new engine and restore state
    const engine = new LudoEngine({ roomId });
    for (const player of gameState.players) {
      engine.addPlayer(player.id, player.displayName, player.avatarUrl);
    }

    this.activeGames.set(roomId, engine);
    return engine;
  }

  /**
   * Handle game end
   */
  async endGame(roomId: string): Promise<void> {
    const engine = this.activeGames.get(roomId);
    if (engine) {
      engine.destroy();
      this.activeGames.delete(roomId);
    }

    await this.redis.updateRoomStatus(roomId, 'finished');
    logger.info({ roomId }, 'Game ended');
  }

  /**
   * Get room by invite code
   */
  async getRoomByInviteCode(inviteCode: string): Promise<Room | null> {
    const roomId = await this.redis.findRoomByInviteCode(inviteCode);
    if (!roomId) return null;
    return this.redis.getRoom(roomId);
  }

  /**
   * Get available public rooms
   */
  async getPublicRooms(): Promise<Room[]> {
    // This would scan Redis for public rooms - simplified for now
    const roomIds = await this.redis.client?.smembers('rooms:active') || [];
    const rooms: Room[] = [];

    for (const roomId of roomIds.slice(0, 20)) {
      const room = await this.redis.getRoom(roomId);
      if (room && !room.isPrivate && room.status === 'waiting') {
        rooms.push(room);
      }
    }

    return rooms;
  }

  // === Private Helpers ===

  private generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
}
