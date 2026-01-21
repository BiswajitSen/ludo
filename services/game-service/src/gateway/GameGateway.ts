import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, GameState, Room } from '@ludo/types';
import { RedisService } from '../services/RedisService.js';
import { RoomManager } from '../services/RoomManager.js';
import { VoiceService } from '../services/VoiceService.js';
import { logger } from '../utils/logger.js';

interface SocketData {
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  roomId?: string;
}

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

export class GameGateway {
  private io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
  private redis: RedisService;
  private roomManager: RoomManager;
  private voiceService: VoiceService;
  private socketToRoom: Map<string, string> = new Map();
  private playerToSocket: Map<string, string> = new Map();

  constructor(
    io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    redis: RedisService,
    roomManager: RoomManager
  ) {
    this.io = io;
    this.redis = redis;
    this.roomManager = roomManager;
    this.voiceService = new VoiceService();
  }

  initialize(): void {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    // Subscribe to cross-server events
    this.redis.subscribePattern('room:*:events', (channel, message) => {
      this.handleCrossServerEvent(channel, message);
    });

    logger.info('Game gateway initialized');
  }

  private handleConnection(socket: GameSocket): void {
    const user = socket.data.user;
    logger.info({ userId: user.id, socketId: socket.id }, 'Client connected');

    // Track socket
    this.playerToSocket.set(user.id, socket.id);

    // Send connection confirmation
    socket.emit('connection:established', { playerId: user.id });

    // Update presence
    this.redis.updatePresence(user.id);

    // Register event handlers
    this.registerRoomHandlers(socket);
    this.registerGameHandlers(socket);
    this.registerChatHandlers(socket);
    this.registerPresenceHandlers(socket);

    // Handle disconnect
    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });
  }

  // === Room Handlers ===

  private registerRoomHandlers(socket: GameSocket): void {
    socket.on('room:create', async (data) => {
      await this.handleCreateRoom(socket, data);
    });

    socket.on('room:join', async (data) => {
      await this.handleJoinRoom(socket, data);
    });

    socket.on('room:leave', async (data) => {
      await this.handleLeaveRoom(socket, data);
    });

    socket.on('room:ready', async (data) => {
      await this.handleReady(socket, data);
    });

    socket.on('room:start', async (data) => {
      await this.handleStartGame(socket, data);
    });

    socket.on('room:kick', async (data) => {
      await this.handleKickPlayer(socket, data);
    });
  }

  private async handleCreateRoom(socket: GameSocket, data: { isPrivate?: boolean }): Promise<void> {
    const user = socket.data.user;
    logger.info({ userId: user.id, isPrivate: data.isPrivate }, 'Creating room');

    try {
      const room = await this.roomManager.createRoom(user.id, user.displayName, user.avatarUrl, {
        isPrivate: data.isPrivate ?? false,
      });

      // Join Socket.IO room
      socket.join(room.id);
      socket.data.roomId = room.id;
      this.socketToRoom.set(socket.id, room.id);

      // Generate voice token
      const voiceData = await this.voiceService.generateToken(room.id, user.id, user.displayName);

      // Generate reconnect token
      const rejoinToken = await this.redis.createReconnectToken(room.id, user.id);

      // Send room data to creator
      socket.emit('room:joined', {
        room,
        gameState: null,
        voiceToken: voiceData.token,
        voiceServerUrl: voiceData.wsUrl,
        rejoinToken,
        yourPlayerId: user.id,
      });

      logger.info({ roomId: room.id, inviteCode: room.inviteCode }, 'Room created successfully');
    } catch (error) {
      logger.error({ error, userId: user.id }, 'Failed to create room');
      socket.emit('error', {
        code: 'ROOM_CREATE_FAILED',
        message: 'Failed to create room',
        recoverable: true,
      });
    }
  }

  private async handleJoinRoom(
    socket: GameSocket,
    data: { roomId: string; rejoinToken?: string }
  ): Promise<void> {
    const user = socket.data.user;

    try {
      // Check for reconnection
      if (data.rejoinToken) {
        const tokenData = await this.redis.validateReconnectToken(data.rejoinToken);
        if (tokenData && tokenData.playerId === user.id) {
          await this.handleReconnection(socket, tokenData.roomId);
          return;
        }
      }

      // Normal join
      const result = await this.roomManager.joinRoom(
        data.roomId,
        user.id,
        user.displayName,
        user.avatarUrl
      );

      if ('error' in result) {
        socket.emit('error', {
          code: 'ROOM_NOT_FOUND',
          message: result.error,
          recoverable: true,
        });
        return;
      }

      const { room, player } = result;
      const actualRoomId = room.id; // Use the actual room ID (in case invite code was used)

      // Check if this socket is already in this room (prevent duplicate joins)
      const existingRoomId = this.socketToRoom.get(socket.id);
      if (existingRoomId === actualRoomId) {
        logger.info(
          { roomId: actualRoomId, userId: user.id },
          'Player already in room, skipping duplicate join'
        );
        return;
      }

      // Join Socket.IO room
      socket.join(actualRoomId);
      socket.data.roomId = actualRoomId;
      this.socketToRoom.set(socket.id, actualRoomId);

      // Generate voice token
      const voiceData = await this.voiceService.generateToken(
        actualRoomId,
        user.id,
        user.displayName
      );

      // Generate reconnect token
      const rejoinToken = await this.redis.createReconnectToken(actualRoomId, user.id);

      // Get game state if game is in progress
      const gameState = await this.redis.getGameState(actualRoomId);

      // Send room data to joining player
      socket.emit('room:joined', {
        room,
        gameState,
        voiceToken: voiceData.token,
        voiceServerUrl: voiceData.wsUrl,
        yourPlayerId: user.id,
        rejoinToken,
      });

      // Check if this is a truly new player (not a rejoin)
      const isNewPlayer = room.players.filter((p) => p.id === user.id).length === 1;

      // Only notify other players if this is a new player joining
      if (isNewPlayer) {
        socket.to(actualRoomId).emit('room:playerJoined', { player });
      }

      logger.info({ roomId: actualRoomId, userId: user.id, isNewPlayer }, 'Player joined room');
    } catch (error) {
      logger.error({ error, roomIdOrCode: data.roomId }, 'Failed to join room');
      socket.emit('error', {
        code: 'INTERNAL_ERROR',
        message: 'Failed to join room',
        recoverable: true,
      });
    }
  }

  private async handleReconnection(socket: GameSocket, roomId: string): Promise<void> {
    const user = socket.data.user;

    const room = await this.redis.getRoom(roomId);
    if (!room) {
      socket.emit('error', {
        code: 'ROOM_NOT_FOUND',
        message: 'Room no longer exists',
        recoverable: false,
      });
      return;
    }

    // Update player status
    await this.redis.updateRoomPlayer(roomId, user.id, {
      status: 'connected',
    });

    // Join socket room
    socket.join(roomId);
    socket.data.roomId = roomId;
    this.socketToRoom.set(socket.id, roomId);

    // Get game state
    const gameState = await this.redis.getGameState(roomId);

    // Restore game engine if needed
    if (gameState?.phase === 'playing') {
      const engine = this.roomManager.getGameEngine(roomId);
      if (engine) {
        engine.handleReconnect(user.id);
      }
    }

    // Generate new tokens
    const voiceData = await this.voiceService.generateToken(roomId, user.id, user.displayName);
    const rejoinToken = await this.redis.createReconnectToken(roomId, user.id);

    const updatedRoom = await this.redis.getRoom(roomId);

    socket.emit('room:joined', {
      room: updatedRoom!,
      gameState,
      voiceToken: voiceData.token,
      voiceServerUrl: voiceData.wsUrl,
      yourPlayerId: user.id,
      rejoinToken,
    });

    // Notify others
    socket.to(roomId).emit('room:playerReconnected', { playerId: user.id });

    logger.info({ roomId, userId: user.id }, 'Player reconnected');
  }

  private async handleLeaveRoom(socket: GameSocket, data: { roomId: string }): Promise<void> {
    const user = socket.data.user;

    try {
      const result = await this.roomManager.leaveRoom(data.roomId, user.id);

      socket.leave(data.roomId);
      this.socketToRoom.delete(socket.id);
      socket.data.roomId = undefined;

      if (result.roomClosed) {
        this.io.to(data.roomId).emit('room:closed', { reason: 'empty' });
      } else {
        this.io.to(data.roomId).emit('room:playerLeft', {
          playerId: user.id,
          reason: 'left',
          canReconnect: false,
        });

        if (result.newHost) {
          this.io.to(data.roomId).emit('room:hostChanged', {
            newHostId: result.newHost,
          });
        }
      }

      logger.info({ roomId: data.roomId, userId: user.id }, 'Player left room');
    } catch (error) {
      logger.error({ error }, 'Failed to leave room');
    }
  }

  private async handleReady(
    socket: GameSocket,
    data: { roomId: string; ready: boolean }
  ): Promise<void> {
    const user = socket.data.user;

    await this.roomManager.setPlayerReady(data.roomId, user.id, data.ready);
    this.io.to(data.roomId).emit('room:playerReady', {
      playerId: user.id,
      ready: data.ready,
    });
  }

  private async handleStartGame(socket: GameSocket, data: { roomId: string }): Promise<void> {
    const user = socket.data.user;

    // First validate and prepare the game (this creates the engine and stores it)
    // We need to set up listeners AFTER the engine is created but BEFORE startGame() is called
    // To do this, we'll use a two-step approach with a prepare method

    const result = await this.roomManager.startGame(data.roomId, user.id);

    if ('error' in result) {
      socket.emit('error', {
        code: 'INVALID_STATE',
        message: result.error,
        recoverable: true,
      });
      return;
    }

    const engine = this.roomManager.getGameEngine(data.roomId);
    if (engine) {
      this.setupGameEngineEvents(data.roomId, engine);
    }

    // Get fresh game state (turnPhase should be 'rolling')
    const gameState = engine ? engine.getGameState() : result;

    // Save to Redis so reconnecting clients get the correct state
    await this.redis.setGameState(data.roomId, gameState);

    // Broadcast game start with the updated state
    this.io.to(data.roomId).emit('game:started', {
      gameId: gameState.gameId,
      gameState,
    });

    // Also broadcast the first turn start event since clients may have missed it
    if (gameState.currentTurn) {
      this.io.to(data.roomId).emit('game:turnStart', {
        playerId: gameState.currentTurn,
        turnNumber: gameState.turnNumber,
        duration: 30000, // Default turn duration
        serverTime: Date.now(),
      });
    }

    logger.info({ roomId: data.roomId }, 'Game started');
  }

  private async handleKickPlayer(
    socket: GameSocket,
    data: { roomId: string; playerId: string }
  ): Promise<void> {
    const user = socket.data.user;
    const room = await this.redis.getRoom(data.roomId);

    if (!room || room.hostId !== user.id) {
      socket.emit('error', {
        code: 'UNAUTHORIZED',
        message: 'Only host can kick players',
        recoverable: true,
      });
      return;
    }

    await this.roomManager.leaveRoom(data.roomId, data.playerId);

    // Find kicked player's socket and remove from room
    const kickedSocketId = this.playerToSocket.get(data.playerId);
    if (kickedSocketId) {
      const kickedSocket = this.io.sockets.sockets.get(kickedSocketId);
      if (kickedSocket) {
        kickedSocket.leave(data.roomId);
        kickedSocket.emit('room:closed', { reason: 'kicked' });
      }
    }

    this.io.to(data.roomId).emit('room:playerLeft', {
      playerId: data.playerId,
      reason: 'kicked',
      canReconnect: false,
    });
  }

  // === Game Handlers ===

  private registerGameHandlers(socket: GameSocket): void {
    socket.on('game:roll', async (data) => {
      await this.handleDiceRoll(socket, data);
    });

    socket.on('game:move', async (data) => {
      await this.handleMove(socket, data);
    });
  }

  private setupGameEngineEvents(roomId: string, engine: any): void {
    logger.info({ roomId }, 'Setting up game engine events');

    engine.on('turnStart', (data: any) => {
      logger.info(
        { roomId, playerId: data.playerId, turnNumber: data.turnNumber },
        'Turn start event received'
      );
      this.io.to(roomId).emit('game:turnStart', {
        playerId: data.playerId,
        turnNumber: data.turnNumber,
        duration: data.duration,
        serverTime: Date.now(),
      });
    });

    engine.on('turnWarning', (data: any) => {
      this.io.to(roomId).emit('game:turnWarning', data);
    });

    engine.on('turnTimeout', (data: any) => {
      this.io.to(roomId).emit('game:turnTimeout', data);
    });

    engine.on('gameEnded', async (data: any) => {
      this.io.to(roomId).emit('game:ended', {
        winner: data.winner,
        rankings: data.rankings.map((r: any) => ({
          playerId: r.playerId,
          displayName: '', // Would need to fetch
          position: r.position,
          tokensHome: r.tokensHome,
          tokensCaptured: 0,
        })),
        matchId: `match_${Date.now()}`,
      });

      await this.roomManager.endGame(roomId);
    });
  }

  private async handleDiceRoll(
    socket: GameSocket,
    data: { roomId: string; timestamp: number }
  ): Promise<void> {
    const user = socket.data.user;
    const engine = this.roomManager.getGameEngine(data.roomId);

    if (!engine) {
      socket.emit('error', {
        code: 'GAME_NOT_STARTED',
        message: 'Game not in progress',
        recoverable: true,
      });
      return;
    }

    const result = engine.rollDice(user.id);
    logger.info(
      {
        roomId: data.roomId,
        playerId: user.id,
        diceValue: result.value,
        validMoves: result.validMoves,
        success: result.success,
      },
      'Dice rolled'
    );

    if (!result.success) {
      socket.emit('error', {
        code: 'NOT_YOUR_TURN',
        message: result.error || 'Cannot roll dice',
        recoverable: true,
      });
      return;
    }

    // Broadcast dice result
    this.io.to(data.roomId).emit('game:diceResult', {
      playerId: user.id,
      value: result.value!,
      validMoves: result.validMoves!,
      turnId: `turn_${Date.now()}`,
    });

    // Update Redis state
    const gameState = engine.getGameState();
    await this.redis.setGameState(data.roomId, gameState);
  }

  private async handleMove(
    socket: GameSocket,
    data: { roomId: string; tokenId: number; moveSequence: number }
  ): Promise<void> {
    const user = socket.data.user;
    const engine = this.roomManager.getGameEngine(data.roomId);

    if (!engine) {
      socket.emit('error', {
        code: 'GAME_NOT_STARTED',
        message: 'Game not in progress',
        recoverable: true,
      });
      return;
    }

    const result = engine.executeMove(user.id, data.tokenId, data.moveSequence);

    if (!result.valid) {
      socket.emit('error', {
        code: 'INVALID_MOVE',
        message: result.reason || 'Invalid move',
        recoverable: true,
      });
      return;
    }

    // Broadcast move
    const gameState = engine.getGameState();
    this.io.to(data.roomId).emit('game:moveExecuted', {
      playerId: user.id,
      tokenId: result.tokenId,
      fromPosition: result.fromPosition,
      toPosition: result.toPosition,
      captures: result.captures,
      bonusTurn: result.bonusTurn,
      boardState: gameState.players,
      moveId: `move_${data.moveSequence}`,
    });

    // Update Redis state
    await this.redis.setGameState(data.roomId, gameState);
  }

  // === Chat Handlers ===

  private registerChatHandlers(socket: GameSocket): void {
    socket.on('chat:message', (data) => {
      const user = socket.data.user;
      this.io.to(data.roomId).emit('chat:message', {
        playerId: user.id,
        displayName: user.displayName,
        message: data.message,
        type: data.type,
        timestamp: Date.now(),
      });
    });
  }

  // === Presence Handlers ===

  private registerPresenceHandlers(socket: GameSocket): void {
    // Ping-pong for presence
    const pingInterval = setInterval(() => {
      socket.emit('ping');
    }, 10000);

    socket.on('pong', () => {
      this.redis.updatePresence(socket.data.user.id);
    });

    socket.on('disconnect', () => {
      clearInterval(pingInterval);
    });
  }

  // === Disconnect Handler ===

  private async handleDisconnect(socket: GameSocket): Promise<void> {
    const user = socket.data.user;
    const roomId = this.socketToRoom.get(socket.id);

    this.playerToSocket.delete(user.id);
    this.socketToRoom.delete(socket.id);
    await this.redis.removePresence(user.id);

    if (roomId) {
      const room = await this.redis.getRoom(roomId);
      if (!room) return;

      if (room.status === 'playing') {
        // Mark as disconnected, allow reconnection
        await this.redis.updateRoomPlayer(roomId, user.id, {
          status: 'disconnected',
        });

        const engine = this.roomManager.getGameEngine(roomId);
        if (engine) {
          engine.handleDisconnect(user.id);
        }

        const reconnectDeadline = Date.now() + 120000; // 2 minutes
        this.io.to(roomId).emit('room:playerLeft', {
          playerId: user.id,
          reason: 'disconnected',
          canReconnect: true,
          reconnectDeadline,
        });

        // Schedule removal if no reconnect
        setTimeout(async () => {
          const currentRoom = await this.redis.getRoom(roomId);
          const player = currentRoom?.players.find((p) => p.id === user.id);
          if (player && (player as any).status === 'disconnected') {
            await this.roomManager.leaveRoom(roomId, user.id);
            this.io.to(roomId).emit('room:playerLeft', {
              playerId: user.id,
              reason: 'disconnected',
              canReconnect: false,
            });
          }
        }, 120000);
      } else {
        // In waiting room - give a short grace period for reconnection (e.g., page navigation)
        const reconnectGrace = 10000; // 10 seconds for waiting room

        setTimeout(async () => {
          // Check if player reconnected
          const currentSocketId = this.playerToSocket.get(user.id);
          if (currentSocketId) {
            // Player reconnected, don't remove
            return;
          }

          // Player didn't reconnect, remove from room
          await this.roomManager.leaveRoom(roomId, user.id);
          this.io.to(roomId).emit('room:playerLeft', {
            playerId: user.id,
            reason: 'disconnected',
            canReconnect: false,
          });
        }, reconnectGrace);
      }
    }

    logger.info({ userId: user.id }, 'Client disconnected');
  }

  // === Cross-Server Events ===

  private handleCrossServerEvent(channel: string, message: any): void {
    // Handle events from other game servers
    const roomId = channel.split(':')[1];
    if (message.type === 'BROADCAST') {
      this.io.to(roomId).emit(message.event, message.data);
    }
  }
}
