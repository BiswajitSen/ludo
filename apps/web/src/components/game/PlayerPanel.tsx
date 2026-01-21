import { motion } from 'framer-motion';
import type { Player, PlayerColor } from '@ludo/types';
import clsx from 'clsx';
import { Home, Target, Hourglass } from 'lucide-react';

interface PlayerPanelProps {
  player: Player;
  isCurrentTurn: boolean;
  isYou: boolean;
}

const COLOR_STYLES: Record<PlayerColor, { bg: string; border: string; text: string }> = {
  red: { bg: 'bg-ludo-red/20', border: 'border-ludo-red', text: 'text-ludo-red' },
  blue: { bg: 'bg-ludo-blue/20', border: 'border-ludo-blue', text: 'text-ludo-blue' },
  green: { bg: 'bg-ludo-green/20', border: 'border-ludo-green', text: 'text-ludo-green' },
  yellow: { bg: 'bg-ludo-yellow/20', border: 'border-ludo-yellow', text: 'text-ludo-yellow' },
};

export function PlayerPanel({ player, isCurrentTurn, isYou }: PlayerPanelProps) {
  const styles = COLOR_STYLES[player.color];
  const tokensHome = player.tokens.filter((t) => t.isHome).length;
  const tokensOut = player.tokens.filter((t) => t.position >= 0 && !t.isHome).length;
  const tokensInYard = player.tokens.filter((t) => t.position === -1).length;

  return (
    <motion.div
      className={clsx(
        'p-3 rounded-lg border-2 transition-all duration-200',
        styles.bg,
        isCurrentTurn ? styles.border : 'border-transparent',
        player.status === 'disconnected' && 'opacity-50'
      )}
      animate={isCurrentTurn ? { scale: [1, 1.02, 1] } : {}}
      transition={{ repeat: Infinity, duration: 2 }}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className={clsx(
            'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold',
            player.color === 'red' && 'bg-ludo-red',
            player.color === 'blue' && 'bg-ludo-blue',
            player.color === 'green' && 'bg-ludo-green',
            player.color === 'yellow' && 'bg-ludo-yellow'
          )}
        >
          {player.displayName[0].toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold truncate min-w-0 flex-1" title={player.displayName}>
              {player.displayName}
            </span>
            {isYou && (
              <span className="text-xs px-1.5 py-0.5 bg-purple-600 rounded text-white flex-shrink-0">
                You
              </span>
            )}
            {isCurrentTurn && (
              <span className={clsx('text-xs flex-shrink-0', styles.text)}>
                Playing...
              </span>
            )}
          </div>

          {/* Token status */}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span className="inline-flex items-center gap-1">
              <Home className="w-3.5 h-3.5" aria-hidden="true" />
              {tokensHome}/4
            </span>
            <span className="inline-flex items-center gap-1">
              <Target className="w-3.5 h-3.5" aria-hidden="true" />
              {tokensOut}
            </span>
            <span className="inline-flex items-center gap-1">
              <Hourglass className="w-3.5 h-3.5" aria-hidden="true" />
              {tokensInYard}
            </span>
          </div>
        </div>

        {/* Status indicator */}
        <div
          className={clsx(
            'w-2 h-2 rounded-full',
            player.status === 'connected' ? 'bg-green-500' : 'bg-gray-500'
          )}
        />
      </div>
    </motion.div>
  );
}
