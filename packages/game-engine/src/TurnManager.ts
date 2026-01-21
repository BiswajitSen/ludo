import { EventEmitter } from 'events';
import {
  TURN_DURATION_MS,
  GRACE_PERIOD_MS,
  MAX_CONSECUTIVE_TIMEOUTS,
} from './constants.js';

export interface TurnConfig {
  turnDurationMs: number;
  gracePeriodMs: number;
  maxConsecutiveTimeouts: number;
}

export interface TurnEvents {
  turnStart: {
    playerId: string;
    duration: number;
    startTime: number;
    turnNumber: number;
  };
  turnWarning: {
    playerId: string;
    remainingMs: number;
  };
  turnTimeout: {
    playerId: string;
    consecutiveTimeouts: number;
  };
  turnComplete: {
    playerId: string;
    duration: number;
  };
  playerAutoForfeit: {
    playerId: string;
    reason: string;
  };
}

export class TurnManager extends EventEmitter {
  private readonly config: TurnConfig;
  private playerOrder: string[] = [];
  private currentPlayerIndex = 0;
  private turnNumber = 0;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveTimeouts: Map<string, number> = new Map();
  private turnStartTime = 0;
  private isPaused = false;
  private pausedRemainingTime = 0;

  constructor(config: Partial<TurnConfig> = {}) {
    super();
    this.config = {
      turnDurationMs: config.turnDurationMs ?? TURN_DURATION_MS,
      gracePeriodMs: config.gracePeriodMs ?? GRACE_PERIOD_MS,
      maxConsecutiveTimeouts:
        config.maxConsecutiveTimeouts ?? MAX_CONSECUTIVE_TIMEOUTS,
    };
  }

  /**
   * Initialize the turn order
   */
  initialize(playerIds: string[]): void {
    this.playerOrder = [...playerIds];
    this.currentPlayerIndex = 0;
    this.turnNumber = 0;
    this.consecutiveTimeouts.clear();

    // Initialize timeout counters
    for (const playerId of playerIds) {
      this.consecutiveTimeouts.set(playerId, 0);
    }
  }

  /**
   * Start the current player's turn
   */
  startTurn(): void {
    this.clearTimers();

    const playerId = this.getCurrentPlayer();
    if (!playerId) return;

    this.turnNumber++;
    this.turnStartTime = Date.now();

    this.emit('turnStart', {
      playerId,
      duration: this.config.turnDurationMs,
      startTime: this.turnStartTime,
      turnNumber: this.turnNumber,
    });

    // Set warning timer
    const warningDelay =
      this.config.turnDurationMs - this.config.gracePeriodMs;

    this.turnTimer = setTimeout(() => {
      this.emit('turnWarning', {
        playerId,
        remainingMs: this.config.gracePeriodMs,
      });

      // Set timeout timer
      this.graceTimer = setTimeout(() => {
        this.handleTimeout(playerId);
      }, this.config.gracePeriodMs);
    }, warningDelay);
  }

  /**
   * Complete the current turn (player made a valid move)
   */
  completeTurn(grantBonusTurn = false): string | null {
    const playerId = this.getCurrentPlayer();
    if (!playerId) return null;

    this.clearTimers();

    // Reset consecutive timeouts for this player
    this.consecutiveTimeouts.set(playerId, 0);

    const duration = Date.now() - this.turnStartTime;
    this.emit('turnComplete', { playerId, duration });

    // Move to next player unless bonus turn
    if (!grantBonusTurn) {
      this.advanceToNextPlayer();
    }

    return this.getCurrentPlayer();
  }

  /**
   * Skip current player's turn (no valid moves)
   */
  skipTurn(): string | null {
    this.clearTimers();
    this.advanceToNextPlayer();
    return this.getCurrentPlayer();
  }

  /**
   * Handle turn timeout
   */
  private handleTimeout(playerId: string): void {
    const timeouts = (this.consecutiveTimeouts.get(playerId) || 0) + 1;
    this.consecutiveTimeouts.set(playerId, timeouts);

    this.emit('turnTimeout', { playerId, consecutiveTimeouts: timeouts });

    if (timeouts >= this.config.maxConsecutiveTimeouts) {
      this.emit('playerAutoForfeit', {
        playerId,
        reason: 'consecutive_timeouts',
      });
      this.removePlayer(playerId);
    } else {
      this.advanceToNextPlayer();
      this.startTurn();
    }
  }

  /**
   * Move to next player in order
   */
  private advanceToNextPlayer(): void {
    if (this.playerOrder.length === 0) return;

    this.currentPlayerIndex =
      (this.currentPlayerIndex + 1) % this.playerOrder.length;
  }

  /**
   * Get current player ID
   */
  getCurrentPlayer(): string | null {
    if (this.playerOrder.length === 0) return null;
    return this.playerOrder[this.currentPlayerIndex];
  }

  /**
   * Get remaining time for current turn
   */
  getRemainingTime(): number {
    if (this.isPaused) return this.pausedRemainingTime;
    if (!this.turnStartTime) return 0;

    const elapsed = Date.now() - this.turnStartTime;
    return Math.max(0, this.config.turnDurationMs - elapsed);
  }

  /**
   * Get current turn number
   */
  getTurnNumber(): number {
    return this.turnNumber;
  }

  /**
   * Get player order
   */
  getPlayerOrder(): string[] {
    return [...this.playerOrder];
  }

  /**
   * Pause the turn timer (for disconnection handling)
   */
  pause(): void {
    if (this.isPaused) return;

    this.isPaused = true;
    this.pausedRemainingTime = this.getRemainingTime();
    this.clearTimers();
  }

  /**
   * Resume the turn timer
   */
  resume(): void {
    if (!this.isPaused) return;

    this.isPaused = false;
    const playerId = this.getCurrentPlayer();
    if (!playerId) return;

    this.turnStartTime = Date.now() - (this.config.turnDurationMs - this.pausedRemainingTime);

    // Recalculate timers based on remaining time
    const remaining = this.pausedRemainingTime;
    const warningThreshold = this.config.gracePeriodMs;

    if (remaining <= 0) {
      this.handleTimeout(playerId);
    } else if (remaining <= warningThreshold) {
      // Already in grace period
      this.emit('turnWarning', { playerId, remainingMs: remaining });
      this.graceTimer = setTimeout(() => {
        this.handleTimeout(playerId);
      }, remaining);
    } else {
      // Normal timer
      this.turnTimer = setTimeout(() => {
        this.emit('turnWarning', { playerId, remainingMs: warningThreshold });
        this.graceTimer = setTimeout(() => {
          this.handleTimeout(playerId);
        }, warningThreshold);
      }, remaining - warningThreshold);
    }

    this.pausedRemainingTime = 0;
  }

  /**
   * Remove a player from the turn order
   */
  removePlayer(playerId: string): void {
    const index = this.playerOrder.indexOf(playerId);
    if (index === -1) return;

    // Adjust current index if needed
    if (index < this.currentPlayerIndex) {
      this.currentPlayerIndex--;
    } else if (index === this.currentPlayerIndex) {
      // Current player is being removed, clear timers
      this.clearTimers();
    }

    this.playerOrder.splice(index, 1);
    this.consecutiveTimeouts.delete(playerId);

    // Handle wrap-around
    if (this.currentPlayerIndex >= this.playerOrder.length) {
      this.currentPlayerIndex = 0;
    }
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.clearTimers();
    this.removeAllListeners();
    this.playerOrder = [];
    this.consecutiveTimeouts.clear();
  }
}
