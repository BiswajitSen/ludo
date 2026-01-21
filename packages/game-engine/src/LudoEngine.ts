import type {
  Player,
  TokenPosition,
  GameState,
  GamePhase,
  TurnPhase,
  MoveResult,
  CaptureInfo,
} from '@ludo/types';
import { DiceRoller, DiceCommitment } from './DiceRoller.js';
import { MoveValidator } from './MoveValidator.js';
import { TurnManager } from './TurnManager.js';
import {
  TOKENS_PER_PLAYER,
  PLAYER_COLORS,
} from './constants.js';
import { EventEmitter } from 'events';

export interface LudoEngineConfig {
  roomId: string;
  turnDurationMs?: number;
  gracePeriodMs?: number;
}

export interface LudoEngineEvents {
  gameStarted: GameState;
  turnStart: {
    playerId: string;
    turnNumber: number;
    duration: number;
  };
  diceRolled: {
    playerId: string;
    value: number;
    validMoves: number[];
    commitment?: string;
  };
  moveExecuted: {
    playerId: string;
    result: MoveResult;
    boardState: Player[];
  };
  turnTimeout: {
    playerId: string;
    consecutiveTimeouts: number;
  };
  turnWarning: {
    playerId: string;
    remainingMs: number;
  };
  playerForfeited: {
    playerId: string;
    reason: string;
  };
  gameEnded: {
    winner: string;
    rankings: Array<{ playerId: string; position: number; tokensHome: number }>;
  };
}

export class LudoEngine extends EventEmitter {
  private readonly roomId: string;
  private gameId: string | null = null;
  private phase: GamePhase = 'waiting';
  private turnPhase: TurnPhase = 'waiting';
  private players: Map<string, Player> = new Map();
  private playerOrder: string[] = [];
  private currentDice: number | null = null;
  private currentCommitment: DiceCommitment | null = null;
  private validMoves: number[] = [];
  private turnManager: TurnManager;
  private moveSequence = 0;
  private startedAt: number | null = null;
  private winner: string | null = null;
  private rankings: Array<{ playerId: string; position: number; tokensHome: number }> = [];

  constructor(config: LudoEngineConfig) {
    super();
    this.roomId = config.roomId;
    this.turnManager = new TurnManager({
      turnDurationMs: config.turnDurationMs,
      gracePeriodMs: config.gracePeriodMs,
    });

    this.setupTurnManagerEvents();
  }

  private setupTurnManagerEvents(): void {
    this.turnManager.on('turnStart', (data) => {
      this.turnPhase = 'rolling';
      this.currentDice = null;
      this.validMoves = [];
      this.emit('turnStart', {
        playerId: data.playerId,
        turnNumber: data.turnNumber,
        duration: data.duration,
      });
    });

    this.turnManager.on('turnWarning', (data) => {
      this.emit('turnWarning', data);
    });

    this.turnManager.on('turnTimeout', (data) => {
      this.handleTurnTimeout(data.playerId);
      this.emit('turnTimeout', data);
    });

    this.turnManager.on('playerAutoForfeit', (data) => {
      this.handlePlayerForfeit(data.playerId, data.reason);
    });
  }

  /**
   * Add a player to the game (before starting)
   */
  addPlayer(
    playerId: string,
    displayName: string,
    avatarUrl: string | null = null
  ): Player | null {
    if (this.phase !== 'waiting') {
      return null;
    }

    if (this.players.size >= 4) {
      return null;
    }

    if (this.players.has(playerId)) {
      return this.players.get(playerId)!;
    }

    const color = PLAYER_COLORS[this.players.size];
    const player: Player = {
      id: playerId,
      displayName,
      avatarUrl,
      color,
      status: 'connected',
      tokens: this.initializeTokens(),
      tokensHome: 0,
    };

    this.players.set(playerId, player);
    this.playerOrder.push(playerId);

    return player;
  }

  /**
   * Remove a player from the game
   */
  removePlayer(playerId: string): boolean {
    if (!this.players.has(playerId)) {
      return false;
    }

    this.players.delete(playerId);
    this.playerOrder = this.playerOrder.filter((id) => id !== playerId);

    if (this.phase === 'playing') {
      this.turnManager.removePlayer(playerId);

      // Check if game should end
      if (this.players.size < 2) {
        this.endGame();
      }
    }

    return true;
  }

  /**
   * Start the game
   */
  startGame(): GameState | null {
    if (this.phase !== 'waiting') {
      return null;
    }

    if (this.players.size < 2) {
      return null;
    }

    this.gameId = this.generateGameId();
    this.phase = 'playing';
    this.startedAt = Date.now();
    this.moveSequence = 0;

    // Randomize player order
    this.playerOrder = this.shuffleArray([...this.playerOrder]);

    // Initialize turn manager
    this.turnManager.initialize(this.playerOrder);

    const gameState = this.getGameState();
    this.emit('gameStarted', gameState);

    // Start first turn
    this.turnManager.startTurn();

    return gameState;
  }

  /**
   * Roll dice for current player
   */
  rollDice(playerId: string): {
    success: boolean;
    value?: number;
    validMoves?: number[];
    commitment?: string;
    error?: string;
  } {
    if (this.phase !== 'playing') {
      return { success: false, error: 'Game not in progress' };
    }

    if (this.turnManager.getCurrentPlayer() !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (this.turnPhase !== 'rolling') {
      return { success: false, error: 'Already rolled' };
    }

    // Generate provably fair dice roll
    this.currentCommitment = DiceRoller.generateCommitment();
    this.currentDice = this.currentCommitment.value;

    // Calculate valid moves
    const player = this.players.get(playerId)!;
    this.validMoves = MoveValidator.getValidMoves(
      player,
      this.currentDice,
      this.getPlayersArray()
    );

    this.turnPhase = 'moving';

    const result = {
      success: true,
      value: this.currentDice,
      validMoves: this.validMoves,
      commitment: this.currentCommitment.commitment,
    };

    this.emit('diceRolled', {
      playerId,
      value: this.currentDice,
      validMoves: this.validMoves,
      commitment: this.currentCommitment.commitment,
    });

    // If no valid moves, auto-advance turn
    if (this.validMoves.length === 0) {
      setTimeout(() => {
        this.turnManager.skipTurn();
        this.turnManager.startTurn();
      }, 1500); // Brief delay to show dice result
    }

    return result;
  }

  /**
   * Execute a token move
   */
  executeMove(
    playerId: string,
    tokenId: number,
    moveSequence: number
  ): MoveResult {
    if (this.phase !== 'playing') {
      return {
        valid: false,
        tokenId,
        fromPosition: -1,
        toPosition: -1,
        captures: [],
        bonusTurn: false,
        gameWon: false,
        reason: 'Game not in progress',
      };
    }

    if (this.turnManager.getCurrentPlayer() !== playerId) {
      return {
        valid: false,
        tokenId,
        fromPosition: -1,
        toPosition: -1,
        captures: [],
        bonusTurn: false,
        gameWon: false,
        reason: 'Not your turn',
      };
    }

    if (this.turnPhase !== 'moving') {
      return {
        valid: false,
        tokenId,
        fromPosition: -1,
        toPosition: -1,
        captures: [],
        bonusTurn: false,
        gameWon: false,
        reason: 'Must roll first',
      };
    }

    if (this.currentDice === null) {
      return {
        valid: false,
        tokenId,
        fromPosition: -1,
        toPosition: -1,
        captures: [],
        bonusTurn: false,
        gameWon: false,
        reason: 'No dice roll',
      };
    }

    // Validate move sequence to prevent replay attacks
    if (moveSequence <= this.moveSequence) {
      return {
        valid: false,
        tokenId,
        fromPosition: -1,
        toPosition: -1,
        captures: [],
        bonusTurn: false,
        gameWon: false,
        reason: 'Stale move sequence',
      };
    }

    if (!this.validMoves.includes(tokenId)) {
      return {
        valid: false,
        tokenId,
        fromPosition: -1,
        toPosition: -1,
        captures: [],
        bonusTurn: false,
        gameWon: false,
        reason: 'Invalid token selection',
      };
    }

    const player = this.players.get(playerId)!;
    const allPlayers = this.getPlayersArray();

    const validation = MoveValidator.validateMove(
      player,
      tokenId,
      this.currentDice,
      allPlayers
    );

    if (!validation.valid) {
      return {
        valid: false,
        tokenId,
        fromPosition: -1,
        toPosition: -1,
        captures: [],
        bonusTurn: false,
        gameWon: false,
        reason: validation.reason,
      };
    }

    // Execute the move
    const token = player.tokens.find((t) => t.tokenId === tokenId)!;
    const fromPosition = token.position;

    token.position = validation.newPosition;
    token.isHome = validation.isHome;

    if (validation.isHome) {
      player.tokensHome++;
    }

    // Execute captures
    const captures: CaptureInfo[] = [];
    for (const capture of validation.captures) {
      const capturedPlayer = this.players.get(capture.playerId);
      if (capturedPlayer) {
        const capturedToken = capturedPlayer.tokens.find(
          (t) => t.tokenId === capture.tokenId
        );
        if (capturedToken) {
          capturedToken.position = -1; // Send back to yard
          captures.push({
            playerId: capture.playerId,
            tokenId: capture.tokenId,
            position: capture.position,
          });
        }
      }
    }

    // Update move sequence
    this.moveSequence = moveSequence;

    const result: MoveResult = {
      valid: true,
      tokenId,
      fromPosition,
      toPosition: validation.newPosition,
      captures,
      bonusTurn: validation.bonusTurn,
      gameWon: MoveValidator.hasPlayerWon(player),
    };

    this.emit('moveExecuted', {
      playerId,
      result,
      boardState: this.getPlayersArray(),
    });

    // Check for win
    if (result.gameWon) {
      this.winner = playerId;
      this.endGame();
      return result;
    }

    // Handle turn advancement
    this.turnPhase = 'waiting';
    this.currentDice = null;
    this.validMoves = [];

    const nextPlayer = this.turnManager.completeTurn(validation.bonusTurn);
    if (nextPlayer) {
      this.turnManager.startTurn();
    }

    return result;
  }

  /**
   * Handle player disconnection
   */
  handleDisconnect(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.status = 'disconnected';

    // Pause turn if it's their turn
    if (this.turnManager.getCurrentPlayer() === playerId) {
      this.turnManager.pause();
    }
  }

  /**
   * Handle player reconnection
   */
  handleReconnect(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.status = 'connected';

    // Resume turn if it was their turn
    if (this.turnManager.getCurrentPlayer() === playerId) {
      this.turnManager.resume();
    }
  }

  /**
   * Handle turn timeout - auto-move or skip
   */
  private handleTurnTimeout(playerId: string): void {
    // If there are valid moves, make a random one
    if (this.validMoves.length > 0 && this.currentDice !== null) {
      const randomTokenId =
        this.validMoves[Math.floor(Math.random() * this.validMoves.length)];
      this.executeMove(playerId, randomTokenId, ++this.moveSequence);
    } else if (this.turnPhase === 'rolling') {
      // Auto-roll and skip if no moves
      this.rollDice(playerId);
    }
  }

  /**
   * Handle player forfeit
   */
  private handlePlayerForfeit(playerId: string, reason: string): void {
    this.emit('playerForfeited', { playerId, reason });
    this.removePlayer(playerId);
  }

  /**
   * End the game and calculate rankings
   */
  private endGame(): void {
    this.phase = 'finished';
    this.turnManager.destroy();

    // Calculate rankings
    const playerArray = this.getPlayersArray();
    playerArray.sort((a, b) => {
      // Winner first
      if (a.id === this.winner) return -1;
      if (b.id === this.winner) return 1;
      // Then by tokens home
      return b.tokensHome - a.tokensHome;
    });

    this.rankings = playerArray.map((p, idx) => ({
      playerId: p.id,
      position: idx + 1,
      tokensHome: p.tokensHome,
    }));

    this.emit('gameEnded', {
      winner: this.winner || playerArray[0]?.id,
      rankings: this.rankings,
    });
  }

  /**
   * Get current game state
   */
  getGameState(): GameState {
    return {
      roomId: this.roomId,
      gameId: this.gameId || '',
      phase: this.phase,
      turnPhase: this.turnPhase,
      players: this.getPlayersArray(),
      playerOrder: [...this.playerOrder],
      currentTurn: this.turnManager.getCurrentPlayer(),
      turnNumber: this.turnManager.getTurnNumber(),
      diceValue: this.currentDice,
      validMoves: [...this.validMoves],
      lastMoveAt: null,
      startedAt: this.startedAt,
      endedAt: this.phase === 'finished' ? Date.now() : null,
      winner: this.winner,
    };
  }

  /**
   * Get players as array
   */
  getPlayersArray(): Player[] {
    return Array.from(this.players.values());
  }

  /**
   * Get a specific player
   */
  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  /**
   * Get current phase
   */
  getPhase(): GamePhase {
    return this.phase;
  }

  /**
   * Get remaining turn time
   */
  getRemainingTurnTime(): number {
    return this.turnManager.getRemainingTime();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.turnManager.destroy();
    this.removeAllListeners();
    this.players.clear();
  }

  // === Private Helpers ===

  private initializeTokens(): TokenPosition[] {
    return Array.from({ length: TOKENS_PER_PLAYER }, (_, i) => ({
      tokenId: i,
      position: -1, // Start in yard
      isHome: false,
    }));
  }

  private generateGameId(): string {
    return `game_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
