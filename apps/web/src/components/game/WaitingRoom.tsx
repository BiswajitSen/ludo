import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Room } from '@ludo/types';
import { useSocket } from '../../hooks/useSocket';
import { useAuthStore } from '../../stores/authStore';
import clsx from 'clsx';

interface WaitingRoomProps {
  room: Room;
  onLeave: () => void;
}

const COLOR_STYLES = {
  red: 'bg-ludo-red',
  blue: 'bg-ludo-blue',
  green: 'bg-ludo-green',
  yellow: 'bg-ludo-yellow',
};

export function WaitingRoom({ room, onLeave }: WaitingRoomProps) {
  const { user } = useAuthStore();
  const { setReady, startGame } = useSocket();
  const [copied, setCopied] = useState(false);

  const isHost = room.hostId === user?.id;
  const myPlayer = room.players.find((p) => p.id === user?.id);
  const canStart = room.players.length >= 2 && room.players.every((p) => p.isHost || p.isReady);

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(room.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReady = () => {
    if (myPlayer) {
      setReady(room.id, !myPlayer.isReady);
    }
  };

  const handleStart = () => {
    startGame(room.id);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card max-w-lg w-full"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">Waiting for Players</h1>
          <p className="text-gray-400">
            {room.players.length}/{room.maxPlayers} players
          </p>
        </div>

        {/* Invite Code */}
        <div className="mb-6 p-4 bg-gray-900/50 rounded-xl text-center">
          <p className="text-sm text-gray-400 mb-2">Share this code with friends</p>
          <button
            onClick={handleCopyCode}
            className="text-4xl font-mono font-bold tracking-widest text-purple-400 hover:text-purple-300 transition-colors"
          >
            {room.inviteCode}
          </button>
          <p className="text-sm text-gray-500 mt-2">
            {copied ? '✓ Copied!' : 'Click to copy'}
          </p>
        </div>

        {/* Players List */}
        <div className="space-y-3 mb-6">
          {room.players.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={clsx(
                'flex items-center gap-3 p-3 rounded-lg',
                'bg-gray-800/50 border border-gray-700'
              )}
            >
              {/* Color indicator */}
              <div
                className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold',
                  player.color && COLOR_STYLES[player.color]
                )}
              >
                {player.displayName[0].toUpperCase()}
              </div>

              {/* Name and status */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold truncate" title={player.displayName}>
                    {player.displayName}
                  </span>
                  {player.isHost && (
                    <span className="text-xs px-1.5 py-0.5 bg-yellow-600 rounded flex-shrink-0">
                      Host
                    </span>
                  )}
                  {player.id === user?.id && (
                    <span className="text-xs px-1.5 py-0.5 bg-purple-600 rounded flex-shrink-0">
                      You
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400">
                  {player.color?.charAt(0).toUpperCase()}{player.color?.slice(1)} player
                </p>
              </div>

              {/* Ready status */}
              {!player.isHost && (
                <div
                  className={clsx(
                    'px-3 py-1 rounded-full text-sm font-medium',
                    player.isReady
                      ? 'bg-green-600/20 text-green-400'
                      : 'bg-gray-600/20 text-gray-400'
                  )}
                >
                  {player.isReady ? 'Ready' : 'Not Ready'}
                </div>
              )}
            </motion.div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: room.maxPlayers - room.players.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/20 border border-dashed border-gray-700"
            >
              <div className="w-10 h-10 rounded-full bg-gray-700/50" />
              <span className="text-gray-500">Waiting for player...</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onLeave} className="btn btn-secondary flex-1">
            Leave
          </button>

          {isHost ? (
            <button
              onClick={handleStart}
              disabled={!canStart}
              className={clsx(
                'btn flex-1',
                canStart ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed'
              )}
            >
              {canStart ? 'Start Game' : 'Waiting...'}
            </button>
          ) : (
            <button
              onClick={handleReady}
              className={clsx(
                'btn flex-1',
                myPlayer?.isReady ? 'btn-secondary' : 'btn-primary'
              )}
            >
              {myPlayer?.isReady ? 'Not Ready' : 'Ready'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
