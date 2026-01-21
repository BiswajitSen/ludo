import { motion } from 'framer-motion';
import type { Player, PlayerColor } from '@ludo/types';
import clsx from 'clsx';

interface LudoBoardProps {
  players: Player[];
  validMoves: number[];
  myPlayerId: string | null;
  isMyTurn: boolean;
  onTokenClick: (tokenId: number) => void;
}

// Board is 15x15 grid
const GRID_SIZE = 15;
const CELL_SIZE = 34; // Slightly smaller for better mobile fit

// Cell types for the grid
type CellType = 
  | 'empty'
  | 'path'
  | 'home-red'
  | 'home-blue'
  | 'home-green'
  | 'home-yellow'
  | 'yard-red'
  | 'yard-blue'
  | 'yard-green'
  | 'yard-yellow'
  | 'center'
  | 'start-red'
  | 'start-blue'
  | 'start-green'
  | 'start-yellow'
  | 'safe';

// Generate the board layout
const generateBoardLayout = (): CellType[][] => {
  const board: CellType[][] = Array(GRID_SIZE).fill(null).map(() => 
    Array(GRID_SIZE).fill('empty')
  );

  // Red yard (bottom-left, rows 9-14, cols 0-5)
  for (let r = 9; r < 15; r++) {
    for (let c = 0; c < 6; c++) {
      board[r][c] = 'yard-red';
    }
  }

  // Blue yard (top-left, rows 0-5, cols 0-5)
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      board[r][c] = 'yard-blue';
    }
  }

  // Green yard (top-right, rows 0-5, cols 9-14)
  for (let r = 0; r < 6; r++) {
    for (let c = 9; c < 15; c++) {
      board[r][c] = 'yard-green';
    }
  }

  // Yellow yard (bottom-right, rows 9-14, cols 9-14)
  for (let r = 9; r < 15; r++) {
    for (let c = 9; c < 15; c++) {
      board[r][c] = 'yard-yellow';
    }
  }

  // Horizontal path (row 6, 7, 8 from col 0-5 and 9-14)
  for (let c = 0; c < 6; c++) {
    board[6][c] = 'path';
    board[7][c] = 'path';
    board[8][c] = 'path';
  }
  for (let c = 9; c < 15; c++) {
    board[6][c] = 'path';
    board[7][c] = 'path';
    board[8][c] = 'path';
  }

  // Vertical path (col 6, 7, 8 from row 0-5 and 9-14)
  for (let r = 0; r < 6; r++) {
    board[r][6] = 'path';
    board[r][7] = 'path';
    board[r][8] = 'path';
  }
  for (let r = 9; r < 15; r++) {
    board[r][6] = 'path';
    board[r][7] = 'path';
    board[r][8] = 'path';
  }

  // Home stretches (colored paths to center)
  // Red home stretch (col 7, rows 9-13, going towards center)
  for (let r = 9; r < 14; r++) {
    board[r][7] = 'home-red';
  }
  // Blue home stretch (row 7, cols 1-5)
  for (let c = 1; c < 6; c++) {
    board[7][c] = 'home-blue';
  }
  // Green home stretch (col 7, rows 1-5)
  for (let r = 1; r < 6; r++) {
    board[r][7] = 'home-green';
  }
  // Yellow home stretch (row 7, cols 9-13)
  for (let c = 9; c < 14; c++) {
    board[7][c] = 'home-yellow';
  }

  // Center home (3x3 area)
  for (let r = 6; r < 9; r++) {
    for (let c = 6; c < 9; c++) {
      board[r][c] = 'center';
    }
  }

  // Start positions (colored cells where tokens enter) - matching POSITION_TO_GRID
  board[13][6] = 'start-red';   // Position 0
  board[6][0] = 'start-blue';   // Position 13
  board[0][8] = 'start-green';  // Position 26
  board[8][14] = 'start-yellow'; // Position 39

  return board;
};

const BOARD_LAYOUT = generateBoardLayout();

// Position to grid coordinates mapping (0-51 main track)
const POSITION_TO_GRID: Record<number, { row: number; col: number }> = {};

// Initialize track positions
const initTrackPositions = () => {
  // Red start and path going up (positions 0-5)
  POSITION_TO_GRID[0] = { row: 13, col: 6 };
  POSITION_TO_GRID[1] = { row: 12, col: 6 };
  POSITION_TO_GRID[2] = { row: 11, col: 6 };
  POSITION_TO_GRID[3] = { row: 10, col: 6 };
  POSITION_TO_GRID[4] = { row: 9, col: 6 };
  POSITION_TO_GRID[5] = { row: 8, col: 6 };
  
  // Turn left (positions 6-12)
  POSITION_TO_GRID[6] = { row: 8, col: 5 };
  POSITION_TO_GRID[7] = { row: 8, col: 4 };
  POSITION_TO_GRID[8] = { row: 8, col: 3 };
  POSITION_TO_GRID[9] = { row: 8, col: 2 };
  POSITION_TO_GRID[10] = { row: 8, col: 1 };
  POSITION_TO_GRID[11] = { row: 8, col: 0 };
  POSITION_TO_GRID[12] = { row: 7, col: 0 };
  
  // Blue start and path going up (positions 13-18)
  POSITION_TO_GRID[13] = { row: 6, col: 0 };
  POSITION_TO_GRID[14] = { row: 6, col: 1 };
  POSITION_TO_GRID[15] = { row: 6, col: 2 };
  POSITION_TO_GRID[16] = { row: 6, col: 3 };
  POSITION_TO_GRID[17] = { row: 6, col: 4 };
  POSITION_TO_GRID[18] = { row: 6, col: 5 };
  
  // Turn up (positions 19-25)
  POSITION_TO_GRID[19] = { row: 5, col: 6 };
  POSITION_TO_GRID[20] = { row: 4, col: 6 };
  POSITION_TO_GRID[21] = { row: 3, col: 6 };
  POSITION_TO_GRID[22] = { row: 2, col: 6 };
  POSITION_TO_GRID[23] = { row: 1, col: 6 };
  POSITION_TO_GRID[24] = { row: 0, col: 6 };
  POSITION_TO_GRID[25] = { row: 0, col: 7 };
  
  // Green start and path going right (positions 26-31)
  POSITION_TO_GRID[26] = { row: 0, col: 8 };
  POSITION_TO_GRID[27] = { row: 1, col: 8 };
  POSITION_TO_GRID[28] = { row: 2, col: 8 };
  POSITION_TO_GRID[29] = { row: 3, col: 8 };
  POSITION_TO_GRID[30] = { row: 4, col: 8 };
  POSITION_TO_GRID[31] = { row: 5, col: 8 };
  
  // Turn right (positions 32-38)
  POSITION_TO_GRID[32] = { row: 6, col: 9 };
  POSITION_TO_GRID[33] = { row: 6, col: 10 };
  POSITION_TO_GRID[34] = { row: 6, col: 11 };
  POSITION_TO_GRID[35] = { row: 6, col: 12 };
  POSITION_TO_GRID[36] = { row: 6, col: 13 };
  POSITION_TO_GRID[37] = { row: 6, col: 14 };
  POSITION_TO_GRID[38] = { row: 7, col: 14 };
  
  // Yellow start and path going down (positions 39-44)
  POSITION_TO_GRID[39] = { row: 8, col: 14 };
  POSITION_TO_GRID[40] = { row: 8, col: 13 };
  POSITION_TO_GRID[41] = { row: 8, col: 12 };
  POSITION_TO_GRID[42] = { row: 8, col: 11 };
  POSITION_TO_GRID[43] = { row: 8, col: 10 };
  POSITION_TO_GRID[44] = { row: 8, col: 9 };
  
  // Turn down (positions 45-51)
  POSITION_TO_GRID[45] = { row: 9, col: 8 };
  POSITION_TO_GRID[46] = { row: 10, col: 8 };
  POSITION_TO_GRID[47] = { row: 11, col: 8 };
  POSITION_TO_GRID[48] = { row: 12, col: 8 };
  POSITION_TO_GRID[49] = { row: 13, col: 8 };
  POSITION_TO_GRID[50] = { row: 14, col: 8 };
  POSITION_TO_GRID[51] = { row: 14, col: 7 };
};

initTrackPositions();

// Home stretch positions (100-105 for each color)
const HOME_STRETCH_GRID: Record<PlayerColor, { row: number; col: number }[]> = {
  red: [
    { row: 13, col: 7 },
    { row: 12, col: 7 },
    { row: 11, col: 7 },
    { row: 10, col: 7 },
    { row: 9, col: 7 },
    { row: 8, col: 7 }, // Center
  ],
  blue: [
    { row: 7, col: 1 },
    { row: 7, col: 2 },
    { row: 7, col: 3 },
    { row: 7, col: 4 },
    { row: 7, col: 5 },
    { row: 7, col: 6 }, // Center
  ],
  green: [
    { row: 1, col: 7 },
    { row: 2, col: 7 },
    { row: 3, col: 7 },
    { row: 4, col: 7 },
    { row: 5, col: 7 },
    { row: 6, col: 7 }, // Center
  ],
  yellow: [
    { row: 7, col: 13 },
    { row: 7, col: 12 },
    { row: 7, col: 11 },
    { row: 7, col: 10 },
    { row: 7, col: 9 },
    { row: 7, col: 8 }, // Center
  ],
};

// Yard token positions (2x2 grid in each corner)
const YARD_POSITIONS: Record<PlayerColor, { row: number; col: number }[]> = {
  red: [
    { row: 10.5, col: 1.5 },
    { row: 10.5, col: 3.5 },
    { row: 12.5, col: 1.5 },
    { row: 12.5, col: 3.5 },
  ],
  blue: [
    { row: 1.5, col: 1.5 },
    { row: 1.5, col: 3.5 },
    { row: 3.5, col: 1.5 },
    { row: 3.5, col: 3.5 },
  ],
  green: [
    { row: 1.5, col: 10.5 },
    { row: 1.5, col: 12.5 },
    { row: 3.5, col: 10.5 },
    { row: 3.5, col: 12.5 },
  ],
  yellow: [
    { row: 10.5, col: 10.5 },
    { row: 10.5, col: 12.5 },
    { row: 12.5, col: 10.5 },
    { row: 12.5, col: 12.5 },
  ],
};

// Cell styling based on type
const getCellStyle = (type: CellType): string => {
  switch (type) {
    case 'yard-red':
      return 'bg-red-500';
    case 'yard-blue':
      return 'bg-blue-500';
    case 'yard-green':
      return 'bg-green-500';
    case 'yard-yellow':
      return 'bg-yellow-400';
    case 'home-red':
      return 'bg-red-400';
    case 'home-blue':
      return 'bg-blue-400';
    case 'home-green':
      return 'bg-green-400';
    case 'home-yellow':
      return 'bg-yellow-300';
    case 'start-red':
      return 'bg-red-300';
    case 'start-blue':
      return 'bg-blue-300';
    case 'start-green':
      return 'bg-green-300';
    case 'start-yellow':
      return 'bg-yellow-200';
    case 'safe':
      return 'bg-gray-200';
    case 'path':
      return 'bg-white';
    case 'center':
      return 'bg-gray-100';
    default:
      return 'bg-transparent';
  }
};

// Check if cell should have a star (safe spot) - matches SAFE_ZONES in engine
// Safe zones: 0, 8, 13, 21, 26, 34, 39, 47
const isSafeSpot = (row: number, col: number): boolean => {
  const safeSpots = [
    { row: 13, col: 6 },  // Position 0 (red start)
    { row: 8, col: 3 },   // Position 8
    { row: 6, col: 0 },   // Position 13 (blue start)
    { row: 3, col: 6 },   // Position 21
    { row: 0, col: 8 },   // Position 26 (green start)
    { row: 6, col: 11 },  // Position 34
    { row: 8, col: 14 },  // Position 39 (yellow start)
    { row: 11, col: 8 },  // Position 47
  ];
  return safeSpots.some(s => s.row === row && s.col === col);
};

// Check if cell is a start position (matches POSITION_TO_GRID positions)
const isStartPosition = (row: number, col: number): PlayerColor | null => {
  if (row === 13 && col === 6) return 'red';    // Position 0
  if (row === 6 && col === 0) return 'blue';    // Position 13
  if (row === 0 && col === 8) return 'green';   // Position 26
  if (row === 8 && col === 14) return 'yellow'; // Position 39
  return null;
};

// Token component
interface TokenProps {
  color: PlayerColor;
  isMovable: boolean;
  isHome: boolean;
  onClick: () => void;
  style: React.CSSProperties;
}

function Token({ color, isMovable, isHome, onClick, style }: TokenProps) {
  const colorClasses: Record<PlayerColor, string> = {
    red: 'bg-red-600 border-red-800',
    blue: 'bg-blue-600 border-blue-800',
    green: 'bg-green-600 border-green-800',
    yellow: 'bg-yellow-500 border-yellow-700',
  };

  return (
    <motion.div
      className={clsx(
        'absolute rounded-full border-2 shadow-lg cursor-pointer',
        'flex items-center justify-center',
        colorClasses[color],
        isMovable && 'ring-2 ring-white ring-offset-2 ring-offset-transparent',
        isHome && 'opacity-50'
      )}
      style={{
        width: CELL_SIZE * 0.7,
        height: CELL_SIZE * 0.7,
        ...style,
      }}
      onClick={onClick}
      animate={isMovable ? {
        scale: [1, 1.15, 1],
        boxShadow: [
          '0 0 0 0 rgba(255,255,255,0.4)',
          '0 0 0 8px rgba(255,255,255,0)',
          '0 0 0 0 rgba(255,255,255,0)',
        ],
      } : {}}
      transition={{
        duration: 1,
        repeat: isMovable ? Infinity : 0,
        ease: 'easeInOut',
      }}
      whileHover={isMovable ? { scale: 1.2 } : {}}
      whileTap={isMovable ? { scale: 0.9 } : {}}
    >
      <div className="w-3 h-3 rounded-full bg-white/40" />
    </motion.div>
  );
}

export function LudoBoard({
  players,
  validMoves,
  myPlayerId,
  isMyTurn,
  onTokenClick,
}: LudoBoardProps) {
  // Get coordinates for a token
  const getTokenPosition = (
    position: number,
    color: PlayerColor,
    tokenId: number
  ): { row: number; col: number } => {
    // In yard
    if (position === -1) {
      return YARD_POSITIONS[color][tokenId];
    }

    // In home stretch (100-105)
    if (position >= 100 && position <= 105) {
      const stretchIndex = position - 100;
      return HOME_STRETCH_GRID[color][stretchIndex] || { row: 7, col: 7 };
    }

    // On main track
    return POSITION_TO_GRID[position] || { row: 7, col: 7 };
  };

  const boardWidth = GRID_SIZE * CELL_SIZE;

  return (
    <div className="relative">
      {/* Board container */}
      <div
        className="relative bg-white rounded-xl shadow-2xl overflow-hidden border-4 border-gray-800"
        style={{
          width: boardWidth,
          height: boardWidth,
        }}
      >
        {/* Grid cells */}
        {BOARD_LAYOUT.map((row, rowIndex) =>
          row.map((cellType, colIndex) => {
            if (cellType === 'empty') return null;

            const startColor = isStartPosition(rowIndex, colIndex);
            const isSafe = isSafeSpot(rowIndex, colIndex);

            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={clsx(
                  'absolute border border-gray-300',
                  getCellStyle(cellType),
                  cellType === 'center' && 'border-none'
                )}
                style={{
                  top: rowIndex * CELL_SIZE,
                  left: colIndex * CELL_SIZE,
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                }}
              >
                {/* Safe spot star */}
                {isSafe && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-lg">
                    ★
                  </div>
                )}
                {/* Start position arrow */}
                {startColor && (
                  <div className={clsx(
                    'absolute inset-0 flex items-center justify-center text-lg font-bold',
                    startColor === 'red' && 'text-red-800',
                    startColor === 'blue' && 'text-blue-800',
                    startColor === 'green' && 'text-green-800',
                    startColor === 'yellow' && 'text-yellow-700',
                  )}>
                    ▶
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Center home triangles */}
        <div
          className="absolute overflow-hidden"
          style={{
            top: 6 * CELL_SIZE,
            left: 6 * CELL_SIZE,
            width: 3 * CELL_SIZE,
            height: 3 * CELL_SIZE,
          }}
        >
          {/* Red triangle (bottom) */}
          <div
            className="absolute bg-red-500"
            style={{
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: `${1.5 * CELL_SIZE}px solid transparent`,
              borderRight: `${1.5 * CELL_SIZE}px solid transparent`,
              borderBottom: `${1.5 * CELL_SIZE}px solid #ef4444`,
            }}
          />
          {/* Blue triangle (left) */}
          <div
            className="absolute"
            style={{
              top: '50%',
              left: 0,
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: `${1.5 * CELL_SIZE}px solid transparent`,
              borderBottom: `${1.5 * CELL_SIZE}px solid transparent`,
              borderLeft: `${1.5 * CELL_SIZE}px solid #3b82f6`,
            }}
          />
          {/* Green triangle (top) */}
          <div
            className="absolute"
            style={{
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: `${1.5 * CELL_SIZE}px solid transparent`,
              borderRight: `${1.5 * CELL_SIZE}px solid transparent`,
              borderTop: `${1.5 * CELL_SIZE}px solid #22c55e`,
            }}
          />
          {/* Yellow triangle (right) */}
          <div
            className="absolute"
            style={{
              top: '50%',
              right: 0,
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: `${1.5 * CELL_SIZE}px solid transparent`,
              borderBottom: `${1.5 * CELL_SIZE}px solid transparent`,
              borderRight: `${1.5 * CELL_SIZE}px solid #eab308`,
            }}
          />
        </div>

        {/* Yard inner circles (token homes) */}
        {(['red', 'blue', 'green', 'yellow'] as PlayerColor[]).map((color) => {
          const yardPositions: Record<PlayerColor, { top: number; left: number }> = {
            red: { top: 10 * CELL_SIZE, left: 1 * CELL_SIZE },
            blue: { top: 1 * CELL_SIZE, left: 1 * CELL_SIZE },
            green: { top: 1 * CELL_SIZE, left: 10 * CELL_SIZE },
            yellow: { top: 10 * CELL_SIZE, left: 10 * CELL_SIZE },
          };

          return (
            <div
              key={`yard-${color}`}
              className="absolute bg-white rounded-lg shadow-inner"
              style={{
                top: yardPositions[color].top,
                left: yardPositions[color].left,
                width: 4 * CELL_SIZE,
                height: 4 * CELL_SIZE,
              }}
            >
              {/* Token spots in yard */}
              {[0, 1, 2, 3].map((idx) => {
                const positions = [
                  { top: 0.5 * CELL_SIZE, left: 0.5 * CELL_SIZE },
                  { top: 0.5 * CELL_SIZE, left: 2.5 * CELL_SIZE },
                  { top: 2.5 * CELL_SIZE, left: 0.5 * CELL_SIZE },
                  { top: 2.5 * CELL_SIZE, left: 2.5 * CELL_SIZE },
                ];
                const colorBg: Record<PlayerColor, string> = {
                  red: 'bg-red-200 border-red-400',
                  blue: 'bg-blue-200 border-blue-400',
                  green: 'bg-green-200 border-green-400',
                  yellow: 'bg-yellow-200 border-yellow-400',
                };
                return (
                  <div
                    key={idx}
                    className={clsx(
                      'absolute rounded-full border-2',
                      colorBg[color]
                    )}
                    style={{
                      top: positions[idx].top,
                      left: positions[idx].left,
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                    }}
                  />
                );
              })}
            </div>
          );
        })}

        {/* Tokens */}
        {players.map((player) =>
          player.tokens.map((token) => {
            const pos = getTokenPosition(
              token.position,
              player.color,
              token.tokenId
            );
            const isMovable =
              isMyTurn && player.id === myPlayerId && validMoves.includes(token.tokenId);

            // Calculate pixel position (center token in cell)
            const x = pos.col * CELL_SIZE + (CELL_SIZE - CELL_SIZE * 0.7) / 2;
            const y = pos.row * CELL_SIZE + (CELL_SIZE - CELL_SIZE * 0.7) / 2;

            return (
              <Token
                key={`${player.id}-${token.tokenId}`}
                color={player.color}
                isMovable={isMovable}
                isHome={token.isHome}
                onClick={() => isMovable && onTokenClick(token.tokenId)}
                style={{
                  left: x,
                  top: y,
                  zIndex: isMovable ? 20 : 10,
                }}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
