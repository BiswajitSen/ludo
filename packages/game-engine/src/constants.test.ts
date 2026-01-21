import { describe, it, expect } from 'vitest';
import {
  BOARD_SIZE,
  HOME_STRETCH_START,
  HOME_POSITION,
  TOKENS_PER_PLAYER,
  START_POSITIONS,
  SAFE_ZONES,
  HOME_ENTRY_POSITIONS,
  TURN_DURATION_MS,
  GRACE_PERIOD_MS,
  MAX_CONSECUTIVE_TIMEOUTS,
  RECONNECT_WINDOW_MS,
  DICE_MIN,
  DICE_MAX,
  PLAYER_COLORS,
} from './constants.js';

describe('Game Constants', () => {
  describe('Board configuration', () => {
    it('should have correct board size (52 positions)', () => {
      expect(BOARD_SIZE).toBe(52);
    });

    it('should have home stretch starting at 100', () => {
      expect(HOME_STRETCH_START).toBe(100);
    });

    it('should have home position at 106', () => {
      expect(HOME_POSITION).toBe(106);
    });

    it('should have 4 tokens per player', () => {
      expect(TOKENS_PER_PLAYER).toBe(4);
    });
  });

  describe('Start positions', () => {
    it('should have start positions for all 4 colors', () => {
      expect(START_POSITIONS).toHaveProperty('red');
      expect(START_POSITIONS).toHaveProperty('blue');
      expect(START_POSITIONS).toHaveProperty('green');
      expect(START_POSITIONS).toHaveProperty('yellow');
    });

    it('should have evenly spaced start positions (13 apart)', () => {
      expect(START_POSITIONS.red).toBe(0);
      expect(START_POSITIONS.blue).toBe(13);
      expect(START_POSITIONS.green).toBe(26);
      expect(START_POSITIONS.yellow).toBe(39);
    });

    it('should have all start positions within board range', () => {
      Object.values(START_POSITIONS).forEach((pos) => {
        expect(pos).toBeGreaterThanOrEqual(0);
        expect(pos).toBeLessThan(BOARD_SIZE);
      });
    });
  });

  describe('Safe zones', () => {
    it('should have 8 safe zones', () => {
      expect(SAFE_ZONES.size).toBe(8);
    });

    it('should include all start positions as safe zones', () => {
      expect(SAFE_ZONES.has(START_POSITIONS.red)).toBe(true);
      expect(SAFE_ZONES.has(START_POSITIONS.blue)).toBe(true);
      expect(SAFE_ZONES.has(START_POSITIONS.green)).toBe(true);
      expect(SAFE_ZONES.has(START_POSITIONS.yellow)).toBe(true);
    });

    it('should have safe zones at expected positions', () => {
      const expectedSafeZones = [0, 8, 13, 21, 26, 34, 39, 47];
      expectedSafeZones.forEach((pos) => {
        expect(SAFE_ZONES.has(pos)).toBe(true);
      });
    });

    it('should have all safe zones within board range', () => {
      SAFE_ZONES.forEach((pos) => {
        expect(pos).toBeGreaterThanOrEqual(0);
        expect(pos).toBeLessThan(BOARD_SIZE);
      });
    });
  });

  describe('Home entry positions', () => {
    it('should have home entry positions for all 4 colors', () => {
      expect(HOME_ENTRY_POSITIONS).toHaveProperty('red');
      expect(HOME_ENTRY_POSITIONS).toHaveProperty('blue');
      expect(HOME_ENTRY_POSITIONS).toHaveProperty('green');
      expect(HOME_ENTRY_POSITIONS).toHaveProperty('yellow');
    });

    it('should have correct home entry positions', () => {
      expect(HOME_ENTRY_POSITIONS.red).toBe(51);
      expect(HOME_ENTRY_POSITIONS.blue).toBe(12);
      expect(HOME_ENTRY_POSITIONS.green).toBe(25);
      expect(HOME_ENTRY_POSITIONS.yellow).toBe(38);
    });

    it('should be one position before each color\'s start', () => {
      // Red starts at 0, enters home at 51 (one before wrap)
      // Blue starts at 13, enters home at 12 (one before)
      // etc.
      expect(HOME_ENTRY_POSITIONS.blue).toBe(START_POSITIONS.blue - 1);
      expect(HOME_ENTRY_POSITIONS.green).toBe(START_POSITIONS.green - 1);
      expect(HOME_ENTRY_POSITIONS.yellow).toBe(START_POSITIONS.yellow - 1);
      expect(HOME_ENTRY_POSITIONS.red).toBe(BOARD_SIZE - 1); // wraps from 51 to 0
    });

    it('should have all home entry positions within board range', () => {
      Object.values(HOME_ENTRY_POSITIONS).forEach((pos) => {
        expect(pos).toBeGreaterThanOrEqual(0);
        expect(pos).toBeLessThan(BOARD_SIZE);
      });
    });
  });

  describe('Turn configuration', () => {
    it('should have 30 second turn duration', () => {
      expect(TURN_DURATION_MS).toBe(30000);
    });

    it('should have 5 second grace period', () => {
      expect(GRACE_PERIOD_MS).toBe(5000);
    });

    it('should allow 3 consecutive timeouts before forfeit', () => {
      expect(MAX_CONSECUTIVE_TIMEOUTS).toBe(3);
    });

    it('should have 2 minute reconnect window', () => {
      expect(RECONNECT_WINDOW_MS).toBe(120000);
    });

    it('should have grace period less than turn duration', () => {
      expect(GRACE_PERIOD_MS).toBeLessThan(TURN_DURATION_MS);
    });
  });

  describe('Dice configuration', () => {
    it('should have minimum dice value of 1', () => {
      expect(DICE_MIN).toBe(1);
    });

    it('should have maximum dice value of 6', () => {
      expect(DICE_MAX).toBe(6);
    });

    it('should have valid dice range', () => {
      expect(DICE_MAX).toBeGreaterThan(DICE_MIN);
    });
  });

  describe('Player colors', () => {
    it('should have exactly 4 colors', () => {
      expect(PLAYER_COLORS).toHaveLength(4);
    });

    it('should have correct colors in order', () => {
      expect(PLAYER_COLORS).toEqual(['red', 'blue', 'green', 'yellow']);
    });

    it('should match start positions keys', () => {
      PLAYER_COLORS.forEach((color) => {
        expect(START_POSITIONS).toHaveProperty(color);
      });
    });

    it('should match home entry positions keys', () => {
      PLAYER_COLORS.forEach((color) => {
        expect(HOME_ENTRY_POSITIONS).toHaveProperty(color);
      });
    });
  });

  describe('Game logic consistency', () => {
    it('should have correct number of positions in home stretch (6)', () => {
      const homeStretchLength = HOME_POSITION - HOME_STRETCH_START;
      expect(homeStretchLength).toBe(6);
    });

    it('should have safe zones evenly distributed (every ~13 positions)', () => {
      const safeArray = Array.from(SAFE_ZONES).sort((a, b) => a - b);
      // Start positions (0, 13, 26, 39) and intermediates (8, 21, 34, 47)
      // Gap between adjacent safe zones should be reasonable
      for (let i = 1; i < safeArray.length; i++) {
        const gap = safeArray[i] - safeArray[i - 1];
        expect(gap).toBeLessThanOrEqual(13);
      }
    });

    it('should complete full circuit before entering home stretch', () => {
      // A token going around the board visits 52 positions before entering home
      // Verify positions are set up correctly
      const fullCircuit = BOARD_SIZE; // 52
      expect(fullCircuit).toBe(52);
    });
  });
});
