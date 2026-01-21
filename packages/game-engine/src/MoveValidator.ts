import type { PlayerColor, Player } from '@ludo/types';
import {
  BOARD_SIZE,
  HOME_STRETCH_START,
  HOME_POSITION,
  SAFE_ZONES,
  START_POSITIONS,
  HOME_ENTRY_POSITIONS,
  DICE_MAX,
} from './constants.js';

export interface MoveValidationResult {
  valid: boolean;
  newPosition: number;
  captures: Array<{ playerId: string; tokenId: number; position: number }>;
  bonusTurn: boolean;
  isHome: boolean;
  reason?: string;
}

export class MoveValidator {
  /**
   * Calculate new position after moving
   */
  static calculateNewPosition(
    currentPosition: number,
    diceValue: number,
    playerColor: PlayerColor
  ): number {
    // Token is in yard - can only come out with a 6
    if (currentPosition === -1) {
      if (diceValue === DICE_MAX) {
        return START_POSITIONS[playerColor];
      }
      return -1; // Can't move
    }

    // Already in home stretch
    if (currentPosition >= HOME_STRETCH_START) {
      const newPos = currentPosition + diceValue;
      // Can't overshoot home
      if (newPos > HOME_POSITION) {
        return -2; // Invalid - overshooting
      }
      return newPos;
    }

    // Normal movement on the board
    const homeEntry = HOME_ENTRY_POSITIONS[playerColor];
    let newPosition = currentPosition;

    // Move step by step to detect home stretch entry
    for (let i = 0; i < diceValue; i++) {
      if (newPosition === homeEntry) {
        // Entering home stretch
        const remainingSteps = diceValue - i - 1;
        const homeStretchPos = HOME_STRETCH_START + remainingSteps;
        if (homeStretchPos > HOME_POSITION) {
          return -2; // Overshooting
        }
        return homeStretchPos;
      }
      newPosition = (newPosition + 1) % BOARD_SIZE;
    }

    return newPosition;
  }

  /**
   * Check if a move is valid
   */
  static validateMove(
    player: Player,
    tokenId: number,
    diceValue: number,
    allPlayers: Player[]
  ): MoveValidationResult {
    const token = player.tokens.find((t) => t.tokenId === tokenId);

    if (!token) {
      return {
        valid: false,
        newPosition: -1,
        captures: [],
        bonusTurn: false,
        isHome: false,
        reason: 'Token not found',
      };
    }

    if (token.isHome) {
      return {
        valid: false,
        newPosition: -1,
        captures: [],
        bonusTurn: false,
        isHome: true,
        reason: 'Token already home',
      };
    }

    // Token in yard needs 6 to come out
    if (token.position === -1 && diceValue !== DICE_MAX) {
      return {
        valid: false,
        newPosition: -1,
        captures: [],
        bonusTurn: false,
        isHome: false,
        reason: 'Need 6 to exit yard',
      };
    }

    const newPosition = this.calculateNewPosition(
      token.position,
      diceValue,
      player.color
    );

    // Can't overshoot home
    if (newPosition === -2) {
      return {
        valid: false,
        newPosition: -1,
        captures: [],
        bonusTurn: false,
        isHome: false,
        reason: 'Would overshoot home',
      };
    }

    // Check for captures
    const captures = this.findCaptures(
      player.id,
      newPosition,
      allPlayers
    );

    const isHome = newPosition === HOME_POSITION;
    const bonusTurn = diceValue === DICE_MAX || captures.length > 0;

    return {
      valid: true,
      newPosition,
      captures,
      bonusTurn,
      isHome,
    };
  }

  /**
   * Get all valid moves for a player given a dice roll
   */
  static getValidMoves(
    player: Player,
    diceValue: number,
    allPlayers: Player[]
  ): number[] {
    const validTokenIds: number[] = [];

    console.log(`[MoveValidator] Checking valid moves for ${player.color} (${player.id}) with dice ${diceValue}`);
    console.log(`[MoveValidator] Player tokens:`, player.tokens);

    for (const token of player.tokens) {
      if (token.isHome) {
        console.log(`[MoveValidator] Token ${token.tokenId}: skipping (already home)`);
        continue;
      }

      const result = this.validateMove(
        player,
        token.tokenId,
        diceValue,
        allPlayers
      );

      console.log(`[MoveValidator] Token ${token.tokenId} at pos ${token.position}: valid=${result.valid}, reason=${result.reason || 'ok'}`);

      if (result.valid) {
        validTokenIds.push(token.tokenId);
      }
    }

    console.log(`[MoveValidator] Valid moves:`, validTokenIds);
    return validTokenIds;
  }

  /**
   * Find tokens that would be captured at a position
   */
  static findCaptures(
    playerId: string,
    position: number,
    allPlayers: Player[]
  ): Array<{ playerId: string; tokenId: number; position: number }> {
    // Can't capture in safe zones or home stretch
    if (position < 0 || position >= HOME_STRETCH_START) {
      return [];
    }

    if (SAFE_ZONES.has(position)) {
      return [];
    }

    const captures: Array<{
      playerId: string;
      tokenId: number;
      position: number;
    }> = [];

    for (const otherPlayer of allPlayers) {
      if (otherPlayer.id === playerId) continue;

      for (const token of otherPlayer.tokens) {
        if (token.position === position && !token.isHome) {
          captures.push({
            playerId: otherPlayer.id,
            tokenId: token.tokenId,
            position: token.position,
          });
        }
      }
    }

    return captures;
  }

  /**
   * Check if a position is a safe zone
   */
  static isSafeZone(position: number): boolean {
    return SAFE_ZONES.has(position);
  }

  /**
   * Check if a position is in home stretch
   */
  static isInHomeStretch(position: number): boolean {
    return position >= HOME_STRETCH_START && position < HOME_POSITION;
  }

  /**
   * Check if token is in yard
   */
  static isInYard(position: number): boolean {
    return position === -1;
  }

  /**
   * Check if all player's tokens are home
   */
  static hasPlayerWon(player: Player): boolean {
    return player.tokens.every((t) => t.isHome);
  }
}
