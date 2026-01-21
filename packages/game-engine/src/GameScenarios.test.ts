import { describe, it, expect } from 'vitest';
import { MoveValidator } from './MoveValidator.js';
import {
  SAFE_ZONES,
  START_POSITIONS,
  HOME_POSITION,
  HOME_STRETCH_START,
  HOME_ENTRY_POSITIONS,
} from './constants.js';
import type { Player, PlayerColor } from '@ludo/types';

// Helper to create a test player with specific token positions
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

describe('Game Scenarios', () => {
  describe('Token Movement - Yard to Board', () => {
    it('should move token from yard to start position with dice 6', () => {
      const red = createPlayer('p1', 'red', [-1, -1, -1, -1]);
      const result = MoveValidator.validateMove(red, 0, 6, [red]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(START_POSITIONS['red']); // 0
    });

    it('should move blue token from yard to position 13 with dice 6', () => {
      const blue = createPlayer('p1', 'blue', [-1, -1, -1, -1]);
      const result = MoveValidator.validateMove(blue, 0, 6, [blue]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(13);
    });

    it('should move green token from yard to position 26 with dice 6', () => {
      const green = createPlayer('p1', 'green', [-1, -1, -1, -1]);
      const result = MoveValidator.validateMove(green, 0, 6, [green]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(26);
    });

    it('should move yellow token from yard to position 39 with dice 6', () => {
      const yellow = createPlayer('p1', 'yellow', [-1, -1, -1, -1]);
      const result = MoveValidator.validateMove(yellow, 0, 6, [yellow]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(39);
    });

    it('should NOT allow yard exit with dice 1-5', () => {
      const red = createPlayer('p1', 'red', [-1, -1, -1, -1]);

      for (let dice = 1; dice <= 5; dice++) {
        const result = MoveValidator.validateMove(red, 0, dice, [red]);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Need 6 to exit yard');
      }
    });
  });

  describe('Token Movement - Normal Board Movement', () => {
    it('should move token forward by dice value', () => {
      const red = createPlayer('p1', 'red', [5, -1, -1, -1]);
      const result = MoveValidator.validateMove(red, 0, 3, [red]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(8); // 5 + 3
    });

    it('should wrap around the board at position 51', () => {
      const blue = createPlayer('p1', 'blue', [50, -1, -1, -1]);
      const result = MoveValidator.validateMove(blue, 0, 4, [blue]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(2); // 50 + 4 = 54, wraps to 2
    });

    it('should allow moving token on board with any dice value', () => {
      const red = createPlayer('p1', 'red', [10, -1, -1, -1]);

      for (let dice = 1; dice <= 6; dice++) {
        const result = MoveValidator.validateMove(red, 0, dice, [red]);
        expect(result.valid).toBe(true);
        expect(result.newPosition).toBe(10 + dice);
      }
    });
  });

  describe('Two Tokens Same Cell - STAR/Safe Zone (No Capture)', () => {
    // Safe zones: 0, 8, 13, 21, 26, 34, 39, 47

    it('should NOT capture opponent at position 0 (red start - safe zone)', () => {
      // Blue at 46, moving 6 would wrap to (46+6) % 52 = 0
      const blue = createPlayer('p2', 'blue', [46, -1, -1, -1]);
      const red = createPlayer('p1', 'red', [0, -1, -1, -1]); // Red at position 0 (safe)

      const result = MoveValidator.validateMove(blue, 0, 6, [blue, red]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(0); // wraps: (46+6) % 52 = 0
      expect(result.captures).toHaveLength(0); // No capture on safe zone!
    });

    it('should NOT capture opponent at position 8 (safe zone)', () => {
      const red = createPlayer('p1', 'red', [5, -1, -1, -1]);
      const blue = createPlayer('p2', 'blue', [8, -1, -1, -1]);

      const result = MoveValidator.validateMove(red, 0, 3, [red, blue]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(8);
      expect(result.captures).toHaveLength(0); // No capture on safe zone!
    });

    it('should NOT capture opponent at position 13 (blue start - safe zone)', () => {
      const red = createPlayer('p1', 'red', [10, -1, -1, -1]);
      const blue = createPlayer('p2', 'blue', [13, -1, -1, -1]);

      const result = MoveValidator.validateMove(red, 0, 3, [red, blue]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(13);
      expect(result.captures).toHaveLength(0); // No capture on safe zone!
    });

    it('should NOT capture opponent at position 21 (safe zone)', () => {
      const red = createPlayer('p1', 'red', [18, -1, -1, -1]);
      const blue = createPlayer('p2', 'blue', [21, -1, -1, -1]);

      const result = MoveValidator.validateMove(red, 0, 3, [red, blue]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(21);
      expect(result.captures).toHaveLength(0);
    });

    it('should NOT capture opponent at position 26 (green start - safe zone)', () => {
      const red = createPlayer('p1', 'red', [24, -1, -1, -1]);
      const green = createPlayer('p3', 'green', [26, -1, -1, -1]);

      const result = MoveValidator.validateMove(red, 0, 2, [red, green]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(26);
      expect(result.captures).toHaveLength(0);
    });

    it('should NOT capture opponent at position 34 (safe zone)', () => {
      const blue = createPlayer('p2', 'blue', [30, -1, -1, -1]);
      const yellow = createPlayer('p4', 'yellow', [34, -1, -1, -1]);

      const result = MoveValidator.validateMove(blue, 0, 4, [blue, yellow]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(34);
      expect(result.captures).toHaveLength(0);
    });

    it('should NOT capture opponent at position 39 (yellow start - safe zone)', () => {
      const green = createPlayer('p3', 'green', [35, -1, -1, -1]);
      const yellow = createPlayer('p4', 'yellow', [39, -1, -1, -1]);

      const result = MoveValidator.validateMove(green, 0, 4, [green, yellow]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(39);
      expect(result.captures).toHaveLength(0);
    });

    it('should NOT capture opponent at position 47 (safe zone)', () => {
      const green = createPlayer('p3', 'green', [45, -1, -1, -1]);
      const red = createPlayer('p1', 'red', [47, -1, -1, -1]);

      const result = MoveValidator.validateMove(green, 0, 2, [green, red]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(47);
      expect(result.captures).toHaveLength(0);
    });

    it('should allow multiple opponents on same safe zone', () => {
      const red = createPlayer('p1', 'red', [6, -1, -1, -1]);
      const blue = createPlayer('p2', 'blue', [8, -1, -1, -1]);
      const green = createPlayer('p3', 'green', [8, -1, -1, -1]);

      const result = MoveValidator.validateMove(red, 0, 2, [red, blue, green]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(8);
      expect(result.captures).toHaveLength(0); // Safe zone - no captures!
    });
  });

  describe('Two Tokens Same Cell - NOT Safe Zone (Capture!)', () => {
    it('should CAPTURE opponent at position 1 (not a safe zone)', () => {
      const red = createPlayer('p1', 'red', [0, -1, -1, -1]);
      const blue = createPlayer('p2', 'blue', [1, -1, -1, -1]);

      const result = MoveValidator.validateMove(red, 0, 1, [red, blue]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(1);
      expect(result.captures).toHaveLength(1);
      expect(result.captures[0].playerId).toBe('p2');
      expect(result.captures[0].tokenId).toBe(0);
    });

    it('should CAPTURE opponent at position 5 (not a safe zone)', () => {
      const red = createPlayer('p1', 'red', [2, -1, -1, -1]);
      const blue = createPlayer('p2', 'blue', [5, -1, -1, -1]);

      const result = MoveValidator.validateMove(red, 0, 3, [red, blue]);

      expect(result.valid).toBe(true);
      expect(result.captures).toHaveLength(1);
      expect(result.captures[0].playerId).toBe('p2');
    });

    it('should CAPTURE opponent at position 10 (between safe zones)', () => {
      const red = createPlayer('p1', 'red', [7, -1, -1, -1]);
      const green = createPlayer('p3', 'green', [10, -1, -1, -1]);

      const result = MoveValidator.validateMove(red, 0, 3, [red, green]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(10);
      expect(result.captures).toHaveLength(1);
    });

    it('should CAPTURE opponent at position 20 (not a safe zone)', () => {
      const blue = createPlayer('p2', 'blue', [15, -1, -1, -1]);
      const yellow = createPlayer('p4', 'yellow', [20, -1, -1, -1]);

      const result = MoveValidator.validateMove(blue, 0, 5, [blue, yellow]);

      expect(result.valid).toBe(true);
      expect(result.captures).toHaveLength(1);
      expect(result.captures[0].playerId).toBe('p4');
    });

    it('should CAPTURE opponent at position 30 (not a safe zone)', () => {
      const green = createPlayer('p3', 'green', [26, -1, -1, -1]);
      const red = createPlayer('p1', 'red', [30, -1, -1, -1]);

      const result = MoveValidator.validateMove(green, 0, 4, [green, red]);

      expect(result.valid).toBe(true);
      expect(result.captures).toHaveLength(1);
    });

    it('should CAPTURE multiple opponents at same non-safe position', () => {
      const red = createPlayer('p1', 'red', [2, -1, -1, -1]);
      const blue = createPlayer('p2', 'blue', [5, -1, -1, -1]);
      const green = createPlayer('p3', 'green', [5, -1, -1, -1]);

      const result = MoveValidator.validateMove(red, 0, 3, [red, blue, green]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(5);
      expect(result.captures).toHaveLength(2);

      const capturedPlayers = result.captures.map((c) => c.playerId).sort();
      expect(capturedPlayers).toEqual(['p2', 'p3']);
    });

    it('should grant bonus turn on capture', () => {
      const red = createPlayer('p1', 'red', [0, -1, -1, -1]);
      const blue = createPlayer('p2', 'blue', [3, -1, -1, -1]);

      const result = MoveValidator.validateMove(red, 0, 3, [red, blue]);

      expect(result.valid).toBe(true);
      expect(result.captures).toHaveLength(1);
      expect(result.bonusTurn).toBe(true); // Bonus turn for capture!
    });
  });

  describe('Own Tokens Same Cell (No Capture)', () => {
    it('should NOT capture own token at any position', () => {
      const red = createPlayer('p1', 'red', [0, 3, -1, -1]);

      const result = MoveValidator.validateMove(red, 0, 3, [red]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(3);
      expect(result.captures).toHaveLength(0); // Never capture own tokens
    });

    it('should allow stacking own tokens at non-safe position', () => {
      const red = createPlayer('p1', 'red', [2, 5, -1, -1]);

      const result = MoveValidator.validateMove(red, 0, 3, [red]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(5);
      expect(result.captures).toHaveLength(0);
    });

    it('should allow stacking own tokens at safe position', () => {
      const blue = createPlayer('p2', 'blue', [5, 8, -1, -1]);

      const result = MoveValidator.validateMove(blue, 0, 3, [blue]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(8);
      expect(result.captures).toHaveLength(0);
    });
  });

  describe('Home Stretch Movement', () => {
    it('should enter home stretch from home entry position', () => {
      // Red's home entry is at 51
      const red = createPlayer('p1', 'red', [51, -1, -1, -1]);
      const result = MoveValidator.validateMove(red, 0, 1, [red]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(HOME_STRETCH_START); // 100
    });

    it('should NOT capture in home stretch (private path)', () => {
      // Home stretch is color-specific, but positions 100-105 are used
      // by all colors. In reality, captures can't happen since each color
      // has its own home stretch path
      const red = createPlayer('p1', 'red', [100, -1, -1, -1]);
      const blue = createPlayer('p2', 'blue', [100, -1, -1, -1]);

      const result = MoveValidator.validateMove(red, 0, 3, [red, blue]);

      expect(result.valid).toBe(true);
      expect(result.captures).toHaveLength(0); // No capture in home stretch
    });

    it('should move within home stretch', () => {
      const red = createPlayer('p1', 'red', [102, -1, -1, -1]);
      const result = MoveValidator.validateMove(red, 0, 2, [red]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(104);
    });

    it('should reach home exactly with correct dice', () => {
      const red = createPlayer('p1', 'red', [105, -1, -1, -1]);
      const result = MoveValidator.validateMove(red, 0, 1, [red]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(HOME_POSITION); // 106
      expect(result.isHome).toBe(true);
    });

    it('should reject move that overshoots home', () => {
      const red = createPlayer('p1', 'red', [105, -1, -1, -1]);
      const result = MoveValidator.validateMove(red, 0, 2, [red]);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Would overshoot home');
    });

    it('should reject move that overshoots from position 104', () => {
      const red = createPlayer('p1', 'red', [104, -1, -1, -1]);
      const result = MoveValidator.validateMove(red, 0, 4, [red]);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Would overshoot home');
    });
  });

  describe('Winning Condition', () => {
    it('should detect when player has all tokens home', () => {
      const red = createPlayer('p1', 'red', [
        HOME_POSITION,
        HOME_POSITION,
        HOME_POSITION,
        HOME_POSITION,
      ]);

      expect(MoveValidator.hasPlayerWon(red)).toBe(true);
    });

    it('should NOT detect win with 3 tokens home', () => {
      const red = createPlayer('p1', 'red', [
        HOME_POSITION,
        HOME_POSITION,
        HOME_POSITION,
        50,
      ]);

      expect(MoveValidator.hasPlayerWon(red)).toBe(false);
    });

    it('should NOT detect win with tokens in home stretch but not home', () => {
      const red = createPlayer('p1', 'red', [
        HOME_POSITION,
        HOME_POSITION,
        HOME_POSITION,
        105,
      ]);

      expect(MoveValidator.hasPlayerWon(red)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle token at position 0 moving with dice 6', () => {
      const red = createPlayer('p1', 'red', [0, -1, -1, -1]);
      const result = MoveValidator.validateMove(red, 0, 6, [red]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(6);
      expect(result.bonusTurn).toBe(true); // Bonus for rolling 6
    });

    it('should handle wrap-around capture scenario', () => {
      // Blue at 49, moving 5 would wrap to position 2 (blue's home entry is at 12, not 51)
      const blue = createPlayer('p2', 'blue', [49, -1, -1, -1]);
      const green = createPlayer('p3', 'green', [2, -1, -1, -1]);

      const result = MoveValidator.validateMove(blue, 0, 5, [blue, green]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(2); // 49 + 5 = 54, 54 % 52 = 2
      expect(result.captures).toHaveLength(1);
    });

    it('should handle token moving from near home entry', () => {
      // Red at 50, one before home entry (51)
      const red = createPlayer('p1', 'red', [50, -1, -1, -1]);
      const result = MoveValidator.validateMove(red, 0, 2, [red]);

      // Should enter home stretch: 50 -> 51 -> 100
      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(HOME_STRETCH_START); // 100
    });

    it('should handle all safe zones are start positions or stars', () => {
      // Verify all safe zones
      const safeZones = [0, 8, 13, 21, 26, 34, 39, 47];
      for (const pos of safeZones) {
        expect(SAFE_ZONES.has(pos)).toBe(true);
        expect(MoveValidator.isSafeZone(pos)).toBe(true);
      }
    });

    it('should verify positions between safe zones are capturable', () => {
      const nonSafePositions = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 14, 15];
      for (const pos of nonSafePositions) {
        expect(MoveValidator.isSafeZone(pos)).toBe(false);
      }
    });
  });

  describe('Complex Scenarios', () => {
    it('4-player game: multiple potential captures, one on safe zone', () => {
      const red = createPlayer('p1', 'red', [0, -1, -1, -1]);
      const blue = createPlayer('p2', 'blue', [6, -1, -1, -1]); // position 6 - not safe
      const green = createPlayer('p3', 'green', [8, -1, -1, -1]); // position 8 - SAFE
      const yellow = createPlayer('p4', 'yellow', [6, -1, -1, -1]); // position 6 - not safe

      // Red moving from 0 to 6
      const result = MoveValidator.validateMove(red, 0, 6, [
        red,
        blue,
        green,
        yellow,
      ]);

      expect(result.valid).toBe(true);
      expect(result.newPosition).toBe(6);
      expect(result.captures).toHaveLength(2); // Blue and Yellow captured
      expect(result.bonusTurn).toBe(true); // Bonus for rolling 6 AND capture
    });

    it('should track valid moves correctly when some tokens cant move', () => {
      // Token 0: in yard (needs 6)
      // Token 1: at position 105 (needs exactly 1)
      // Token 2: at position 10 (can move)
      // Token 3: home (can't move)
      const red = createPlayer('p1', 'red', [-1, 105, 10, HOME_POSITION]);

      // With dice 3:
      const validMoves = MoveValidator.getValidMoves(red, 3, [red]);

      expect(validMoves).not.toContain(0); // In yard, needs 6
      expect(validMoves).not.toContain(1); // Would overshoot (105 + 3 = 108 > 106)
      expect(validMoves).toContain(2); // Can move 10 -> 13
      expect(validMoves).not.toContain(3); // Already home
    });

    it('should correctly identify all 8 safe zone positions', () => {
      const safeZoneList = Array.from(SAFE_ZONES);
      expect(safeZoneList.sort((a, b) => a - b)).toEqual([
        0, 8, 13, 21, 26, 34, 39, 47,
      ]);

      // Start positions are safe
      expect(SAFE_ZONES.has(START_POSITIONS['red'])).toBe(true); // 0
      expect(SAFE_ZONES.has(START_POSITIONS['blue'])).toBe(true); // 13
      expect(SAFE_ZONES.has(START_POSITIONS['green'])).toBe(true); // 26
      expect(SAFE_ZONES.has(START_POSITIONS['yellow'])).toBe(true); // 39

      // Additional star positions are safe
      expect(SAFE_ZONES.has(8)).toBe(true);
      expect(SAFE_ZONES.has(21)).toBe(true);
      expect(SAFE_ZONES.has(34)).toBe(true);
      expect(SAFE_ZONES.has(47)).toBe(true);
    });
  });
});
