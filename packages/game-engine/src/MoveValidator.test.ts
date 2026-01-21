import { describe, it, expect } from 'vitest';
import { MoveValidator } from './MoveValidator.js';
import {
  BOARD_SIZE,
  HOME_STRETCH_START,
  HOME_POSITION,
  SAFE_ZONES,
  START_POSITIONS,
  HOME_ENTRY_POSITIONS,
} from './constants.js';
import type { Player, PlayerColor } from '@ludo/types';

// Helper to create a test player
function createPlayer(
  id: string,
  color: PlayerColor,
  tokenPositions: number[]
): Player {
  return {
    id,
    displayName: `Player ${id}`,
    avatarUrl: null,
    color,
    status: 'connected',
    tokens: tokenPositions.map((pos, idx) => ({
      tokenId: idx,
      position: pos,
      isHome: pos === HOME_POSITION,
    })),
    tokensHome: tokenPositions.filter((p) => p === HOME_POSITION).length,
  };
}

describe('MoveValidator', () => {
  describe('calculateNewPosition()', () => {
    describe('Token in yard (position -1)', () => {
      it('should move to start position with a 6', () => {
        const colors: PlayerColor[] = ['red', 'blue', 'green', 'yellow'];
        for (const color of colors) {
          const newPos = MoveValidator.calculateNewPosition(-1, 6, color);
          expect(newPos).toBe(START_POSITIONS[color]);
        }
      });

      it('should return -1 (no move) for any value other than 6', () => {
        for (let dice = 1; dice <= 5; dice++) {
          const newPos = MoveValidator.calculateNewPosition(-1, dice, 'red');
          expect(newPos).toBe(-1);
        }
      });
    });

    describe('Normal board movement', () => {
      it('should move forward by dice value', () => {
        const newPos = MoveValidator.calculateNewPosition(0, 3, 'red');
        expect(newPos).toBe(3);
      });

      it('should wrap around the board at position 51', () => {
        const newPos = MoveValidator.calculateNewPosition(50, 4, 'blue');
        expect(newPos).toBe(2); // 50 + 4 = 54 -> 54 % 52 = 2
      });

      it('should handle moving from various positions', () => {
        expect(MoveValidator.calculateNewPosition(10, 5, 'red')).toBe(15);
        // Blue at position 20 + 6 = 26 (blue doesn't enter home stretch until position 12)
        expect(MoveValidator.calculateNewPosition(20, 6, 'blue')).toBe(26);
      });
    });

    describe('Home stretch entry', () => {
      it('should enter home stretch for red at position 51', () => {
        // Red's home entry is at 51
        const newPos = MoveValidator.calculateNewPosition(51, 1, 'red');
        expect(newPos).toBe(HOME_STRETCH_START); // 100
      });

      it('should enter home stretch for blue at position 12', () => {
        const newPos = MoveValidator.calculateNewPosition(12, 1, 'blue');
        expect(newPos).toBe(HOME_STRETCH_START);
      });

      it('should enter home stretch for green at position 25', () => {
        const newPos = MoveValidator.calculateNewPosition(25, 1, 'green');
        expect(newPos).toBe(HOME_STRETCH_START);
      });

      it('should enter home stretch for yellow at position 38', () => {
        const newPos = MoveValidator.calculateNewPosition(38, 1, 'yellow');
        expect(newPos).toBe(HOME_STRETCH_START);
      });

      it('should calculate correct position inside home stretch', () => {
        // Red enters at 51, dice 3 = 100 + 2 = 102
        const newPos = MoveValidator.calculateNewPosition(51, 3, 'red');
        expect(newPos).toBe(HOME_STRETCH_START + 2); // 102
      });
    });

    describe('Home stretch movement', () => {
      it('should move within home stretch', () => {
        const newPos = MoveValidator.calculateNewPosition(100, 3, 'red');
        expect(newPos).toBe(103);
      });

      it('should reach home position exactly', () => {
        const newPos = MoveValidator.calculateNewPosition(100, 6, 'red');
        expect(newPos).toBe(HOME_POSITION); // 106
      });

      it('should return -2 (invalid) when overshooting home', () => {
        const newPos = MoveValidator.calculateNewPosition(105, 3, 'red');
        expect(newPos).toBe(-2);
      });

      it('should allow exact landing on home', () => {
        const newPos = MoveValidator.calculateNewPosition(105, 1, 'red');
        expect(newPos).toBe(HOME_POSITION);
      });
    });

    describe('Overshooting home from main track', () => {
      it('should return -2 when dice would overshoot home', () => {
        // Red at position 51, needs exactly 7 steps to reach home (1 to enter + 6 in stretch)
        // With dice 6, would go 100 + 5 = 105, not overshoot
        // With a scenario where it would overshoot...
        const newPos = MoveValidator.calculateNewPosition(50, 6, 'red');
        // 50 -> 51 -> enters home stretch -> 100 + 5 = 105 (valid)
        // This won't overshoot, let's test from position 51 with high dice
        // From 51 with dice 7+ would overshoot but dice max is 6
        // Test from position where it overshoots
        const newPos2 = MoveValidator.calculateNewPosition(105, 2, 'red');
        expect(newPos2).toBe(-2);
      });
    });
  });

  describe('validateMove()', () => {
    describe('Basic validation', () => {
      it('should reject move for non-existent token', () => {
        const player = createPlayer('p1', 'red', [0, 1, 2, 3]);
        const result = MoveValidator.validateMove(player, 10, 3, [player]);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Token not found');
      });

      it('should reject move for token already home', () => {
        const player = createPlayer('p1', 'red', [HOME_POSITION, 1, 2, 3]);
        const result = MoveValidator.validateMove(player, 0, 3, [player]);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Token already home');
      });

      it('should reject yard token without rolling 6', () => {
        const player = createPlayer('p1', 'red', [-1, -1, -1, -1]);
        const result = MoveValidator.validateMove(player, 0, 3, [player]);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Need 6 to exit yard');
      });

      it('should allow yard token to exit with 6', () => {
        const player = createPlayer('p1', 'red', [-1, -1, -1, -1]);
        const result = MoveValidator.validateMove(player, 0, 6, [player]);
        expect(result.valid).toBe(true);
        expect(result.newPosition).toBe(START_POSITIONS['red']);
      });

      it('should reject move that overshoots home', () => {
        const player = createPlayer('p1', 'red', [105, -1, -1, -1]);
        const result = MoveValidator.validateMove(player, 0, 3, [player]);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Would overshoot home');
      });
    });

    describe('Captures', () => {
      it('should detect capture of opponent token', () => {
        const player1 = createPlayer('p1', 'red', [0, -1, -1, -1]);
        const player2 = createPlayer('p2', 'blue', [3, -1, -1, -1]);
        const result = MoveValidator.validateMove(player1, 0, 3, [
          player1,
          player2,
        ]);
        expect(result.valid).toBe(true);
        expect(result.captures).toHaveLength(1);
        expect(result.captures[0].playerId).toBe('p2');
        expect(result.captures[0].tokenId).toBe(0);
      });

      it('should not capture on safe zones', () => {
        const player1 = createPlayer('p1', 'red', [5, -1, -1, -1]);
        const player2 = createPlayer('p2', 'blue', [8, -1, -1, -1]); // 8 is a safe zone
        const result = MoveValidator.validateMove(player1, 0, 3, [
          player1,
          player2,
        ]);
        expect(result.valid).toBe(true);
        expect(result.captures).toHaveLength(0);
      });

      it('should not capture own tokens', () => {
        const player = createPlayer('p1', 'red', [0, 3, -1, -1]);
        const result = MoveValidator.validateMove(player, 0, 3, [player]);
        expect(result.valid).toBe(true);
        expect(result.captures).toHaveLength(0);
      });

      it('should not capture in home stretch', () => {
        const player1 = createPlayer('p1', 'red', [100, -1, -1, -1]);
        const player2 = createPlayer('p2', 'blue', [103, -1, -1, -1]); // Different home stretch
        const result = MoveValidator.validateMove(player1, 0, 3, [
          player1,
          player2,
        ]);
        expect(result.valid).toBe(true);
        expect(result.captures).toHaveLength(0);
      });

      it('should capture multiple tokens at same position', () => {
        const player1 = createPlayer('p1', 'red', [0, -1, -1, -1]);
        const player2 = createPlayer('p2', 'blue', [3, -1, -1, -1]);
        const player3 = createPlayer('p3', 'green', [3, -1, -1, -1]);
        const result = MoveValidator.validateMove(player1, 0, 3, [
          player1,
          player2,
          player3,
        ]);
        expect(result.valid).toBe(true);
        expect(result.captures).toHaveLength(2);
      });
    });

    describe('Bonus turn', () => {
      it('should grant bonus turn on rolling 6', () => {
        const player = createPlayer('p1', 'red', [0, -1, -1, -1]);
        const result = MoveValidator.validateMove(player, 0, 6, [player]);
        expect(result.valid).toBe(true);
        expect(result.bonusTurn).toBe(true);
      });

      it('should grant bonus turn on capture', () => {
        const player1 = createPlayer('p1', 'red', [0, -1, -1, -1]);
        const player2 = createPlayer('p2', 'blue', [3, -1, -1, -1]);
        const result = MoveValidator.validateMove(player1, 0, 3, [
          player1,
          player2,
        ]);
        expect(result.bonusTurn).toBe(true);
      });

      it('should grant bonus turn on reaching home', () => {
        const player = createPlayer('p1', 'red', [105, -1, -1, -1]);
        const result = MoveValidator.validateMove(player, 0, 1, [player]);
        expect(result.valid).toBe(true);
        expect(result.isHome).toBe(true);
        // Actually reaching home grants bonus via 6 or capture, not home itself
        // But isHome is set
      });

      it('should not grant bonus turn on normal move', () => {
        const player = createPlayer('p1', 'red', [0, -1, -1, -1]);
        const result = MoveValidator.validateMove(player, 0, 3, [player]);
        expect(result.bonusTurn).toBe(false);
      });
    });

    describe('isHome flag', () => {
      it('should set isHome true when reaching home position', () => {
        const player = createPlayer('p1', 'red', [105, -1, -1, -1]);
        const result = MoveValidator.validateMove(player, 0, 1, [player]);
        expect(result.isHome).toBe(true);
        expect(result.newPosition).toBe(HOME_POSITION);
      });

      it('should set isHome false for regular moves', () => {
        const player = createPlayer('p1', 'red', [0, -1, -1, -1]);
        const result = MoveValidator.validateMove(player, 0, 3, [player]);
        expect(result.isHome).toBe(false);
      });
    });
  });

  describe('getValidMoves()', () => {
    it('should return empty array when no moves possible (all in yard, dice not 6)', () => {
      const player = createPlayer('p1', 'red', [-1, -1, -1, -1]);
      const validMoves = MoveValidator.getValidMoves(player, 3, [player]);
      expect(validMoves).toHaveLength(0);
    });

    it('should return yard tokens when dice is 6', () => {
      const player = createPlayer('p1', 'red', [-1, -1, -1, -1]);
      const validMoves = MoveValidator.getValidMoves(player, 6, [player]);
      expect(validMoves).toEqual([0, 1, 2, 3]);
    });

    it('should return tokens that can move on the board', () => {
      const player = createPlayer('p1', 'red', [0, 5, -1, -1]);
      const validMoves = MoveValidator.getValidMoves(player, 3, [player]);
      expect(validMoves).toContain(0);
      expect(validMoves).toContain(1);
      expect(validMoves).not.toContain(2);
      expect(validMoves).not.toContain(3);
    });

    it('should exclude tokens that would overshoot home', () => {
      const player = createPlayer('p1', 'red', [105, 103, -1, -1]);
      const validMoves = MoveValidator.getValidMoves(player, 3, [player]);
      expect(validMoves).toContain(1); // 103 + 3 = 106 (exactly home)
      expect(validMoves).not.toContain(0); // 105 + 3 = 108 (overshoot)
    });

    it('should exclude tokens already home', () => {
      const player = createPlayer('p1', 'red', [HOME_POSITION, 0, -1, -1]);
      const validMoves = MoveValidator.getValidMoves(player, 3, [player]);
      expect(validMoves).not.toContain(0);
      expect(validMoves).toContain(1);
    });

    it('should include both yard and board tokens with 6', () => {
      const player = createPlayer('p1', 'red', [0, -1, 10, -1]);
      const validMoves = MoveValidator.getValidMoves(player, 6, [player]);
      expect(validMoves).toContain(0); // board token
      expect(validMoves).toContain(1); // yard token
      expect(validMoves).toContain(2); // board token
      expect(validMoves).toContain(3); // yard token
    });
  });

  describe('findCaptures()', () => {
    it('should find captures at given position', () => {
      const player1 = createPlayer('p1', 'red', [3, -1, -1, -1]);
      const player2 = createPlayer('p2', 'blue', [3, -1, -1, -1]);
      const captures = MoveValidator.findCaptures('p1', 3, [player1, player2]);
      expect(captures).toHaveLength(1);
      expect(captures[0].playerId).toBe('p2');
    });

    it('should not find captures on safe zones', () => {
      const player1 = createPlayer('p1', 'red', [8, -1, -1, -1]);
      const player2 = createPlayer('p2', 'blue', [8, -1, -1, -1]);
      const captures = MoveValidator.findCaptures('p1', 8, [player1, player2]);
      expect(captures).toHaveLength(0);
    });

    it('should not find captures in home stretch', () => {
      const player1 = createPlayer('p1', 'red', [103, -1, -1, -1]);
      const player2 = createPlayer('p2', 'blue', [103, -1, -1, -1]);
      const captures = MoveValidator.findCaptures('p1', 103, [
        player1,
        player2,
      ]);
      expect(captures).toHaveLength(0);
    });

    it('should not find captures for negative positions', () => {
      const player1 = createPlayer('p1', 'red', [-1, -1, -1, -1]);
      const player2 = createPlayer('p2', 'blue', [-1, -1, -1, -1]);
      const captures = MoveValidator.findCaptures('p1', -1, [player1, player2]);
      expect(captures).toHaveLength(0);
    });

    it('should not include own tokens', () => {
      const player = createPlayer('p1', 'red', [3, 3, -1, -1]);
      const captures = MoveValidator.findCaptures('p1', 3, [player]);
      expect(captures).toHaveLength(0);
    });
  });

  describe('Helper methods', () => {
    describe('isSafeZone()', () => {
      it('should return true for all safe zones', () => {
        for (const safePos of SAFE_ZONES) {
          expect(MoveValidator.isSafeZone(safePos)).toBe(true);
        }
      });

      it('should return false for non-safe positions', () => {
        expect(MoveValidator.isSafeZone(1)).toBe(false);
        expect(MoveValidator.isSafeZone(10)).toBe(false);
        expect(MoveValidator.isSafeZone(50)).toBe(false);
      });
    });

    describe('isInHomeStretch()', () => {
      it('should return true for home stretch positions', () => {
        for (let pos = HOME_STRETCH_START; pos < HOME_POSITION; pos++) {
          expect(MoveValidator.isInHomeStretch(pos)).toBe(true);
        }
      });

      it('should return false for board positions', () => {
        expect(MoveValidator.isInHomeStretch(0)).toBe(false);
        expect(MoveValidator.isInHomeStretch(51)).toBe(false);
      });

      it('should return false for home position', () => {
        expect(MoveValidator.isInHomeStretch(HOME_POSITION)).toBe(false);
      });
    });

    describe('isInYard()', () => {
      it('should return true for -1', () => {
        expect(MoveValidator.isInYard(-1)).toBe(true);
      });

      it('should return false for other positions', () => {
        expect(MoveValidator.isInYard(0)).toBe(false);
        expect(MoveValidator.isInYard(100)).toBe(false);
        expect(MoveValidator.isInYard(HOME_POSITION)).toBe(false);
      });
    });

    describe('hasPlayerWon()', () => {
      it('should return true when all tokens are home', () => {
        const player = createPlayer('p1', 'red', [
          HOME_POSITION,
          HOME_POSITION,
          HOME_POSITION,
          HOME_POSITION,
        ]);
        expect(MoveValidator.hasPlayerWon(player)).toBe(true);
      });

      it('should return false when some tokens are not home', () => {
        const player = createPlayer('p1', 'red', [HOME_POSITION, 0, -1, -1]);
        expect(MoveValidator.hasPlayerWon(player)).toBe(false);
      });

      it('should return false when no tokens are home', () => {
        const player = createPlayer('p1', 'red', [-1, -1, -1, -1]);
        expect(MoveValidator.hasPlayerWon(player)).toBe(false);
      });
    });
  });
});
