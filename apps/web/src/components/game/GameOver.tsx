import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { useAuthStore } from '../../stores/authStore';

interface GameOverProps {
  onLeave: () => void;
}

export function GameOver({ onLeave }: GameOverProps) {
  const { gameState, myPlayerId } = useGameStore();

  const winner = gameState?.players.find((p) => p.id === gameState.winner);
  const isWinner = gameState?.winner === myPlayerId;

  // Sort players by tokens home (winner first)
  const rankings = [...(gameState?.players || [])].sort((a, b) => {
    if (a.id === gameState?.winner) return -1;
    if (b.id === gameState?.winner) return 1;
    return b.tokensHome - a.tokensHome;
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card max-w-md w-full text-center"
      >
        {/* Trophy / Result */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="text-6xl mb-4"
        >
          {isWinner ? '🏆' : '🎮'}
        </motion.div>

        <h1 className="text-3xl font-bold mb-2">
          {isWinner ? 'You Won!' : 'Game Over'}
        </h1>

        {winner && (
          <p className="text-gray-400 mb-6">
            {isWinner
              ? 'Congratulations on your victory!'
              : `${winner.displayName} won the game`}
          </p>
        )}

        {/* Rankings */}
        <div className="space-y-2 mb-6">
          {rankings.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                index === 0 ? 'bg-yellow-600/20' : 'bg-gray-800/50'
              }`}
            >
              <span className="text-2xl font-bold text-gray-500 w-8">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
              </span>
              <div className="flex-1 text-left">
                <span className="font-semibold">
                  {player.displayName}
                  {player.id === myPlayerId && (
                    <span className="text-purple-400 text-sm ml-2">(You)</span>
                  )}
                </span>
              </div>
              <span className="text-gray-400">
                {player.tokensHome}/4 home
              </span>
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button onClick={onLeave} className="btn btn-primary w-full">
            Back to Lobby
          </button>
        </div>
      </motion.div>
    </div>
  );
}
