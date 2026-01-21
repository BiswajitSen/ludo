import RedisLib from 'ioredis';
import { logger } from '../utils/logger.js';
import type { Room, GameState, RoomPlayer } from '@ludo/types';

// Handle ESM/CJS compatibility
const Redis = (RedisLib as any).default || RedisLib;
type RedisClient = InstanceType<typeof Redis>;

export class RedisService {
  private _client: RedisClient | null = null;
  private subscriber: RedisClient | null = null;
  private publisher: RedisClient | null = null;

  // Public getter for client access
  get client(): RedisClient | null {
    return this._client;
  }

  async connect(): Promise<void> {
    const config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    };

    this._client = new Redis(config);
    this.subscriber = new Redis(config);
    this.publisher = new Redis(config);

    this._client.on('error', (err) => logger.error('Redis client error', err));
    this.subscriber.on('error', (err) => logger.error('Redis subscriber error', err));
    this.publisher.on('error', (err) => logger.error('Redis publisher error', err));

    await Promise.all([
      new Promise<void>((resolve) => this._client!.once('ready', resolve)),
      new Promise<void>((resolve) => this.subscriber!.once('ready', resolve)),
      new Promise<void>((resolve) => this.publisher!.once('ready', resolve)),
    ]);
  }

  async disconnect(): Promise<void> {
    await Promise.all([this._client?.quit(), this.subscriber?.quit(), this.publisher?.quit()]);
  }

  // === Room Operations ===

  async createRoom(room: Room): Promise<void> {
    const key = `room:${room.id}`;
    await this._client!.hset(key, {
      id: room.id,
      status: room.status,
      hostId: room.hostId,
      isPrivate: room.isPrivate ? '1' : '0',
      inviteCode: room.inviteCode,
      maxPlayers: room.maxPlayers.toString(),
      createdAt: room.createdAt.toString(),
      gameServerId: room.gameServerId || '',
    });
    await this._client!.expire(key, 86400); // 24h TTL
    await this._client!.sadd('rooms:active', room.id);
  }

  async getRoom(roomId: string): Promise<Room | null> {
    const data = await this._client!.hgetall(`room:${roomId}`);
    if (!data.id) return null;

    const players = await this.getRoomPlayers(roomId);

    return {
      id: data.id,
      status: data.status as Room['status'],
      hostId: data.hostId,
      isPrivate: data.isPrivate === '1',
      inviteCode: data.inviteCode,
      maxPlayers: parseInt(data.maxPlayers),
      players,
      createdAt: parseInt(data.createdAt),
      gameServerId: data.gameServerId || null,
    };
  }

  async updateRoomStatus(roomId: string, status: Room['status']): Promise<void> {
    await this._client!.hset(`room:${roomId}`, 'status', status);
  }

  async deleteRoom(roomId: string): Promise<void> {
    const pipeline = this._client!.pipeline();
    pipeline.del(`room:${roomId}`);
    pipeline.del(`room:${roomId}:players`);
    pipeline.del(`game:${roomId}:state`);
    pipeline.srem('rooms:active', roomId);
    await pipeline.exec();
  }

  async findRoomByInviteCode(inviteCode: string): Promise<string | null> {
    const roomIds = await this._client!.smembers('rooms:active');
    for (const roomId of roomIds) {
      const code = await this._client!.hget(`room:${roomId}`, 'inviteCode');
      if (code === inviteCode) {
        return roomId;
      }
    }
    return null;
  }

  // === Room Players ===

  async addRoomPlayer(roomId: string, player: RoomPlayer): Promise<void> {
    await this._client!.hset(`room:${roomId}:players`, player.id, JSON.stringify(player));
  }

  async removeRoomPlayer(roomId: string, playerId: string): Promise<void> {
    await this._client!.hdel(`room:${roomId}:players`, playerId);
  }

  async getRoomPlayers(roomId: string): Promise<RoomPlayer[]> {
    const data = await this._client!.hgetall(`room:${roomId}:players`);
    return Object.values(data).map((json) => JSON.parse(json as string));
  }

  async updateRoomPlayer(
    roomId: string,
    playerId: string,
    updates: Partial<RoomPlayer>
  ): Promise<void> {
    const current = await this._client!.hget(`room:${roomId}:players`, playerId);
    if (!current) return;

    const player = { ...JSON.parse(current), ...updates };
    await this._client!.hset(`room:${roomId}:players`, playerId, JSON.stringify(player));
  }

  // === Game State ===

  async setGameState(roomId: string, state: GameState): Promise<void> {
    await this._client!.set(`game:${roomId}:state`, JSON.stringify(state));
  }

  async getGameState(roomId: string): Promise<GameState | null> {
    const data = await this._client!.get(`game:${roomId}:state`);
    return data ? JSON.parse(data) : null;
  }

  // === Reconnection Tokens ===

  async createReconnectToken(roomId: string, playerId: string): Promise<string> {
    const token = `${roomId}:${playerId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    await this._client!.setex(
      `reconnect:${token}`,
      300, // 5 minutes
      JSON.stringify({ roomId, playerId, createdAt: Date.now() })
    );
    return token;
  }

  async validateReconnectToken(
    token: string
  ): Promise<{ roomId: string; playerId: string } | null> {
    const data = await this._client!.get(`reconnect:${token}`);
    if (!data) return null;
    await this._client!.del(`reconnect:${token}`);
    return JSON.parse(data);
  }

  // === Presence ===

  async updatePresence(playerId: string): Promise<void> {
    await this._client!.zadd('presence:online', Date.now(), playerId);
  }

  async removePresence(playerId: string): Promise<void> {
    await this._client!.zrem('presence:online', playerId);
  }

  async getOnlinePlayers(since: number = Date.now() - 60000): Promise<string[]> {
    return this._client!.zrangebyscore('presence:online', since, '+inf');
  }

  // === Pub/Sub ===

  async publish(channel: string, message: object): Promise<void> {
    await this.publisher!.publish(channel, JSON.stringify(message));
  }

  subscribe(channel: string, handler: (message: object) => void): void {
    this.subscriber!.subscribe(channel);
    this.subscriber!.on('message', (ch, msg) => {
      if (ch === channel) {
        try {
          handler(JSON.parse(msg));
        } catch (e) {
          logger.error('Failed to parse pub/sub message', e);
        }
      }
    });
  }

  subscribePattern(pattern: string, handler: (channel: string, message: object) => void): void {
    this.subscriber!.psubscribe(pattern);
    this.subscriber!.on('pmessage', (pat, ch, msg) => {
      if (pat === pattern) {
        try {
          handler(ch, JSON.parse(msg));
        } catch (e) {
          logger.error('Failed to parse pub/sub message', e);
        }
      }
    });
  }

  // === Matchmaking Queue ===

  async addToMatchmakingQueue(mode: string, playerId: string, data: object): Promise<void> {
    await this._client!.zadd(
      `matchmaking:queue:${mode}`,
      Date.now(),
      JSON.stringify({ playerId, ...data })
    );
  }

  async removeFromMatchmakingQueue(mode: string, playerId: string): Promise<void> {
    // Get all entries and filter out the player
    const entries = await this._client!.zrange(`matchmaking:queue:${mode}`, 0, -1);
    for (const entry of entries) {
      const data = JSON.parse(entry);
      if (data.playerId === playerId) {
        await this._client!.zrem(`matchmaking:queue:${mode}`, entry);
        break;
      }
    }
  }

  async getMatchmakingQueue(mode: string, count: number = 10): Promise<any[]> {
    const entries = await this._client!.zrange(`matchmaking:queue:${mode}`, 0, count - 1);
    return entries.map((e) => JSON.parse(e));
  }
}
