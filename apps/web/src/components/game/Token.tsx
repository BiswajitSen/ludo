import { motion } from 'framer-motion';
import type { PlayerColor } from '@ludo/types';
import clsx from 'clsx';

interface TokenProps {
  color: PlayerColor;
  position: { x: number; y: number };
  isMovable: boolean;
  isHome: boolean;
  onClick: () => void;
}

const COLOR_STYLES: Record<PlayerColor, string> = {
  red: 'bg-ludo-red border-red-800 shadow-red-500/50',
  blue: 'bg-ludo-blue border-blue-800 shadow-blue-500/50',
  green: 'bg-ludo-green border-green-800 shadow-green-500/50',
  yellow: 'bg-ludo-yellow border-yellow-600 shadow-yellow-500/50',
};

export function Token({
  color,
  position,
  isMovable,
  isHome,
  onClick,
}: TokenProps) {
  if (isHome) {
    return null; // Don't render tokens that are home
  }

  return (
    <motion.button
      className={clsx(
        'absolute w-6 h-6 rounded-full border-2 shadow-lg',
        'flex items-center justify-center',
        'transition-all duration-200',
        COLOR_STYLES[color],
        isMovable && 'cursor-pointer ring-2 ring-white ring-offset-2 animate-pulse',
        !isMovable && 'cursor-default'
      )}
      style={{
        transform: `translate(${position.x + 3}px, ${position.y + 3}px)`,
      }}
      animate={{
        x: position.x + 3,
        y: position.y + 3,
        scale: isMovable ? [1, 1.1, 1] : 1,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
        scale: {
          repeat: isMovable ? Infinity : 0,
          duration: 0.5,
        },
      }}
      onClick={onClick}
      disabled={!isMovable}
      whileHover={isMovable ? { scale: 1.2 } : undefined}
      whileTap={isMovable ? { scale: 0.9 } : undefined}
    >
      {/* Inner shine effect */}
      <div className="absolute inset-1 rounded-full bg-white/30" />
    </motion.button>
  );
}
