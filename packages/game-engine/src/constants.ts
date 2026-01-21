// Board configuration
export const BOARD_SIZE = 52;
export const HOME_STRETCH_START = 100;
export const HOME_POSITION = 106;
export const TOKENS_PER_PLAYER = 4;

// Starting positions for each color (clockwise from red)
export const START_POSITIONS: Record<string, number> = {
  red: 0,
  blue: 13,
  green: 26,
  yellow: 39,
};

// Safe zones (can't be captured here)
export const SAFE_ZONES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Home stretch entry positions (one before entering home stretch)
export const HOME_ENTRY_POSITIONS: Record<string, number> = {
  red: 51,
  blue: 12,
  green: 25,
  yellow: 38,
};

// Turn configuration
export const TURN_DURATION_MS = 30000; // 30 seconds
export const GRACE_PERIOD_MS = 5000; // 5 second warning
export const MAX_CONSECUTIVE_TIMEOUTS = 3;
export const RECONNECT_WINDOW_MS = 120000; // 2 minutes

// Dice
export const DICE_MIN = 1;
export const DICE_MAX = 6;

// Player colors in order
export const PLAYER_COLORS = ['red', 'blue', 'green', 'yellow'] as const;
