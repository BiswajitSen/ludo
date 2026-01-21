import { randomBytes, createHash } from 'crypto';
import { DICE_MIN, DICE_MAX } from './constants.js';

export interface DiceCommitment {
  secret: string;
  commitment: string;
  value: number;
}

/**
 * Cryptographically secure dice roller with provably fair support
 */
export class DiceRoller {
  private static readonly DICE_FACES = DICE_MAX - DICE_MIN + 1;

  /**
   * Generates a cryptographically secure dice roll
   * Uses rejection sampling to ensure uniform distribution
   */
  static roll(): number {
    const maxValid = Math.floor(256 / this.DICE_FACES) * this.DICE_FACES;

    let randomValue: number;
    do {
      const buffer = randomBytes(1);
      randomValue = buffer[0];
    } while (randomValue >= maxValid);

    return (randomValue % this.DICE_FACES) + DICE_MIN;
  }

  /**
   * Generate multiple dice rolls at once
   */
  static rollMultiple(count: number): number[] {
    return Array.from({ length: count }, () => this.roll());
  }

  /**
   * Commit-reveal scheme for provably fair dice
   * Server commits to value before player "rolls"
   */
  static generateCommitment(): DiceCommitment {
    const secret = randomBytes(32).toString('hex');
    const value = this.roll();
    const commitment = this.hash(`${secret}:${value}`);

    return {
      secret,
      commitment,
      value,
    };
  }

  /**
   * Create a commitment string that can be sent to clients
   */
  static createCommitmentString(commitment: DiceCommitment): string {
    return `${commitment.secret}:${commitment.value}`;
  }

  /**
   * Verify a commitment and extract the dice value
   */
  static verifyCommitment(
    secretWithValue: string,
    commitment: string
  ): number | null {
    const computedCommitment = this.hash(secretWithValue);
    if (computedCommitment !== commitment) {
      return null;
    }

    const parts = secretWithValue.split(':');
    if (parts.length !== 2) {
      return null;
    }

    const value = parseInt(parts[1], 10);
    if (isNaN(value) || value < DICE_MIN || value > DICE_MAX) {
      return null;
    }

    return value;
  }

  /**
   * SHA-256 hash function
   */
  private static hash(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  /**
   * Validate a dice value is within valid range
   */
  static isValidValue(value: number): boolean {
    return (
      Number.isInteger(value) && value >= DICE_MIN && value <= DICE_MAX
    );
  }
}
