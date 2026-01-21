import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { useSocket } from '../hooks/useSocket';

export function LobbyPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { isConnected, createRoom, joinRoom } = useSocket();

  const [inviteCode, setInviteCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = async (isPrivate: boolean) => {
    setIsCreating(true);
    setError('');

    try {
      const roomId = await createRoom(isPrivate);
      navigate(`/game/${roomId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      const roomId = await joinRoom(inviteCode.trim().toUpperCase());
      navigate(`/game/${roomId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join room');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen p-4">
      {/* Header */}
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-2 gap-0.5 w-10 h-10">
            <div className="bg-ludo-red rounded-tl-lg" />
            <div className="bg-ludo-blue rounded-tr-lg" />
            <div className="bg-ludo-green rounded-bl-lg" />
            <div className="bg-ludo-yellow rounded-br-lg" />
          </div>
          <h1 className="text-2xl font-bold">Ludo</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-bold">
              {user?.displayName?.[0]?.toUpperCase() || '?'}
            </div>
            <span className="text-gray-300">{user?.displayName}</span>
          </div>

          <button onClick={logout} className="text-gray-400 hover:text-white">
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid md:grid-cols-2 gap-6"
        >
          {/* Create Room */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Create Room</h2>
            <p className="text-gray-400 mb-6">
              Start a new game and invite your friends
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleCreateRoom(false)}
                disabled={isCreating || !isConnected}
                className="btn btn-primary w-full"
              >
                {isCreating ? 'Creating...' : 'Create Public Room'}
              </button>

              <button
                onClick={() => handleCreateRoom(true)}
                disabled={isCreating || !isConnected}
                className="btn btn-secondary w-full"
              >
                {isCreating ? 'Creating...' : 'Create Private Room'}
              </button>
            </div>
          </div>

          {/* Join Room */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Join Room</h2>
            <p className="text-gray-400 mb-6">
              Enter an invite code to join a friend's game
            </p>

            <div className="space-y-3">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                placeholder="Enter invite code"
                className="input text-center text-2xl tracking-widest uppercase"
                maxLength={6}
              />

              <button
                onClick={handleJoinRoom}
                disabled={isJoining || !isConnected}
                className="btn btn-primary w-full"
              >
                {isJoining ? 'Joining...' : 'Join Room'}
              </button>
            </div>
          </div>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-center"
          >
            {error}
          </motion.div>
        )}

        {!isConnected && (
          <div className="mt-4 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-400 text-center">
            Connecting to server...
          </div>
        )}

        {/* Quick Match Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card mt-6"
        >
          <h2 className="text-xl font-bold mb-4">Quick Match</h2>
          <p className="text-gray-400 mb-6">
            Find random opponents and start playing immediately
          </p>

          <div className="grid grid-cols-3 gap-3">
            <button
              disabled
              className="btn btn-secondary opacity-50 cursor-not-allowed"
            >
              2 Players
            </button>
            <button
              disabled
              className="btn btn-secondary opacity-50 cursor-not-allowed"
            >
              3 Players
            </button>
            <button
              disabled
              className="btn btn-secondary opacity-50 cursor-not-allowed"
            >
              4 Players
            </button>
          </div>

          <p className="text-sm text-gray-500 mt-3 text-center">
            Coming soon
          </p>
        </motion.div>

        {/* How to Play */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card mt-6"
        >
          <h2 className="text-xl font-bold mb-4">How to Play</h2>
          <div className="grid md:grid-cols-4 gap-4 text-sm text-gray-400">
            <div className="text-center">
              <div className="text-3xl mb-2">🎲</div>
              <p>Roll dice to move your tokens</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">6️⃣</div>
              <p>Roll 6 to bring tokens out</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🏠</div>
              <p>Get all 4 tokens home to win</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">💥</div>
              <p>Capture opponents on the way</p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
