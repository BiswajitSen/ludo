import { describe, it, expect } from 'vitest';
import { DiceRoller } from './DiceRoller.js';
import { DICE_MIN, DICE_MAX } from './constants.js';

describe('DiceRoller', () => {
  describe('roll()', () => {
    it('should return a value between DICE_MIN and DICE_MAX', () => {
      for (let i = 0; i < 100; i++) {
        const value = DiceRoller.roll();
        expect(value).toBeGreaterThanOrEqual(DICE_MIN);
        expect(value).toBeLessThanOrEqual(DICE_MAX);
      }
    });

    it('should return an integer', () => {
      for (let i = 0; i < 50; i++) {
        const value = DiceRoller.roll();
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it('should produce all possible values over many rolls (distribution test)', () => {
      const counts: Record<number, number> = {};
      const rolls = 1000;

      for (let i = 0; i < rolls; i++) {
        const value = DiceRoller.roll();
        counts[value] = (counts[value] || 0) + 1;
      }

      // All values from 1-6 should appear
      for (let v = DICE_MIN; v <= DICE_MAX; v++) {
        expect(counts[v]).toBeGreaterThan(0);
      }
    });
  });

  describe('rollMultiple()', () => {
    it('should return the correct number of rolls', () => {
      const count = 5;
      const rolls = DiceRoller.rollMultiple(count);
      expect(rolls).toHaveLength(count);
    });

    it('should return all valid values', () => {
      const rolls = DiceRoller.rollMultiple(20);
      for (const value of rolls) {
        expect(value).toBeGreaterThanOrEqual(DICE_MIN);
        expect(value).toBeLessThanOrEqual(DICE_MAX);
      }
    });

    it('should return empty array for count 0', () => {
      const rolls = DiceRoller.rollMultiple(0);
      expect(rolls).toHaveLength(0);
    });
  });

  describe('generateCommitment()', () => {
    it('should return a valid commitment object', () => {
      const commitment = DiceRoller.generateCommitment();

      expect(commitment).toHaveProperty('secret');
      expect(commitment).toHaveProperty('commitment');
      expect(commitment).toHaveProperty('value');

      expect(typeof commitment.secret).toBe('string');
      expect(typeof commitment.commitment).toBe('string');
      expect(typeof commitment.value).toBe('number');
    });

    it('should have a valid dice value', () => {
      const commitment = DiceRoller.generateCommitment();
      expect(commitment.value).toBeGreaterThanOrEqual(DICE_MIN);
      expect(commitment.value).toBeLessThanOrEqual(DICE_MAX);
    });

    it('should generate unique secrets', () => {
      const secrets = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const commitment = DiceRoller.generateCommitment();
        secrets.add(commitment.secret);
      }
      expect(secrets.size).toBe(100);
    });

    it('should generate a 64-character hex secret', () => {
      const commitment = DiceRoller.generateCommitment();
      expect(commitment.secret).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate a 64-character hex commitment hash', () => {
      const commitment = DiceRoller.generateCommitment();
      expect(commitment.commitment).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('createCommitmentString()', () => {
    it('should create the correct format', () => {
      const commitment = DiceRoller.generateCommitment();
      const str = DiceRoller.createCommitmentString(commitment);
      expect(str).toBe(`${commitment.secret}:${commitment.value}`);
    });
  });

  describe('verifyCommitment()', () => {
    it('should verify a valid commitment', () => {
      const commitment = DiceRoller.generateCommitment();
      const secretWithValue = DiceRoller.createCommitmentString(commitment);
      const verified = DiceRoller.verifyCommitment(
        secretWithValue,
        commitment.commitment
      );
      expect(verified).toBe(commitment.value);
    });

    it('should reject invalid commitment (tampered value)', () => {
      const commitment = DiceRoller.generateCommitment();
      const tamperedValue = (commitment.value % 6) + 1;
      const tamperedString = `${commitment.secret}:${tamperedValue}`;
      const verified = DiceRoller.verifyCommitment(
        tamperedString,
        commitment.commitment
      );
      expect(verified).toBeNull();
    });

    it('should reject invalid commitment (tampered secret)', () => {
      const commitment = DiceRoller.generateCommitment();
      const tamperedSecret = commitment.secret.replace('a', 'b');
      const tamperedString = `${tamperedSecret}:${commitment.value}`;
      const verified = DiceRoller.verifyCommitment(
        tamperedString,
        commitment.commitment
      );
      expect(verified).toBeNull();
    });

    it('should reject malformed input (no colon)', () => {
      const verified = DiceRoller.verifyCommitment('invalid', 'somehash');
      expect(verified).toBeNull();
    });

    it('should reject invalid dice value', () => {
      const commitment = DiceRoller.generateCommitment();
      const invalidString = `${commitment.secret}:7`;
      const verified = DiceRoller.verifyCommitment(invalidString, 'somehash');
      expect(verified).toBeNull();
    });

    it('should reject non-numeric dice value', () => {
      const commitment = DiceRoller.generateCommitment();
      const invalidString = `${commitment.secret}:abc`;
      const verified = DiceRoller.verifyCommitment(invalidString, 'somehash');
      expect(verified).toBeNull();
    });
  });

  describe('isValidValue()', () => {
    it('should return true for valid values (1-6)', () => {
      for (let v = DICE_MIN; v <= DICE_MAX; v++) {
        expect(DiceRoller.isValidValue(v)).toBe(true);
      }
    });

    it('should return false for values below minimum', () => {
      expect(DiceRoller.isValidValue(0)).toBe(false);
      expect(DiceRoller.isValidValue(-1)).toBe(false);
    });

    it('should return false for values above maximum', () => {
      expect(DiceRoller.isValidValue(7)).toBe(false);
      expect(DiceRoller.isValidValue(100)).toBe(false);
    });

    it('should return false for non-integers', () => {
      expect(DiceRoller.isValidValue(1.5)).toBe(false);
      expect(DiceRoller.isValidValue(3.14)).toBe(false);
    });

    it('should return false for NaN and Infinity', () => {
      expect(DiceRoller.isValidValue(NaN)).toBe(false);
      expect(DiceRoller.isValidValue(Infinity)).toBe(false);
    });
  });
});
