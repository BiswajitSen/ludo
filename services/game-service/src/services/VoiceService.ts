import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { logger } from '../utils/logger.js';

export class VoiceService {
  private roomService: RoomServiceClient | null = null;
  private initialized = false;

  private getConfig() {
    return {
      apiKey: process.env.LIVEKIT_API_KEY || '',
      apiSecret: process.env.LIVEKIT_API_SECRET || '',
      wsUrl: process.env.LIVEKIT_WS_URL || 'ws://localhost:7880',
      host: process.env.LIVEKIT_HOST || 'http://localhost:7880',
    };
  }

  private ensureInitialized() {
    if (this.initialized) return;
    
    const config = this.getConfig();
    if (config.apiKey && config.apiSecret) {
      this.roomService = new RoomServiceClient(
        config.host,
        config.apiKey,
        config.apiSecret
      );
      logger.info('VoiceService initialized with LiveKit');
    } else {
      logger.warn('LiveKit not configured - voice chat will be disabled');
    }
    this.initialized = true;
  }

  /**
   * Generate access token for player to join voice room
   */
  async generateToken(
    roomId: string,
    participantId: string,
    participantName: string
  ): Promise<{ token: string; wsUrl: string }> {
    this.ensureInitialized();
    const config = this.getConfig();

    // If LiveKit is not configured, return empty token
    if (!config.apiKey || !config.apiSecret) {
      return { token: '', wsUrl: '' };
    }

    try {
      const token = new AccessToken(config.apiKey, config.apiSecret, {
        identity: participantId,
        name: participantName,
        ttl: 3600, // 1 hour
      });

      token.addGrant({
        room: roomId,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: false,
      });

      const jwt = await token.toJwt();
      logger.info({ roomId, participantId }, 'Generated voice token');
      
      return {
        token: jwt,
        wsUrl: config.wsUrl,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to generate voice token');
      return { token: '', wsUrl: '' };
    }
  }

  /**
   * Create voice room when game room is created
   */
  async createRoom(roomId: string): Promise<void> {
    this.ensureInitialized();
    if (!this.roomService) return;

    try {
      await this.roomService.createRoom({
        name: roomId,
        emptyTimeout: 300,
        maxParticipants: 4,
        metadata: JSON.stringify({ type: 'game_voice' }),
      });
    } catch (error) {
      logger.error({ error, roomId }, 'Failed to create voice room');
    }
  }

  /**
   * Delete voice room when game ends
   */
  async deleteRoom(roomId: string): Promise<void> {
    this.ensureInitialized();
    if (!this.roomService) return;

    try {
      await this.roomService.deleteRoom(roomId);
    } catch (error) {
      logger.error({ error, roomId }, 'Failed to delete voice room');
    }
  }

  /**
   * Mute a participant (admin action)
   */
  async muteParticipant(roomId: string, participantId: string): Promise<void> {
    this.ensureInitialized();
    if (!this.roomService) return;

    try {
      await this.roomService.mutePublishedTrack(roomId, participantId, '', true);
    } catch (error) {
      logger.error({ error }, 'Failed to mute participant');
    }
  }

  /**
   * Remove participant from voice room
   */
  async removeParticipant(roomId: string, participantId: string): Promise<void> {
    this.ensureInitialized();
    if (!this.roomService) return;

    try {
      await this.roomService.removeParticipant(roomId, participantId);
    } catch (error) {
      logger.error({ error }, 'Failed to remove participant');
    }
  }
}
