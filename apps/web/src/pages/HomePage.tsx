import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';

export function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, setAuth, logout } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGuestLogin = async () => {
    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await api.post<{ user: any; tokens: any }>('/api/auth/guest', {
        displayName: displayName.trim(),
      });

      const { user, tokens } = response.data;
      setAuth(user, tokens.accessToken, tokens.refreshToken);
      navigate('/lobby');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || ''}/api/auth/google`;
  };

  if (isAuthenticated && user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card max-w-md w-full text-center"
        >
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Welcome back!
          </h1>
          <p className="text-gray-400 mb-8">{user.displayName}</p>

          <div className="space-y-4">
            <button
              onClick={() => navigate('/lobby')}
              className="btn btn-primary w-full text-lg"
            >
              Play Now
            </button>

            <button
              onClick={logout}
              className="btn btn-secondary w-full"
            >
              Logout
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card max-w-md w-full relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', bounce: 0.5 }}
            className="inline-block"
          >
            <div className="grid grid-cols-2 gap-1 w-20 h-20 mx-auto mb-4">
              <div className="bg-ludo-red rounded-tl-xl" />
              <div className="bg-ludo-blue rounded-tr-xl" />
              <div className="bg-ludo-green rounded-bl-xl" />
              <div className="bg-ludo-yellow rounded-br-xl" />
            </div>
          </motion.div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Ludo
          </h1>
          <p className="text-gray-400 mt-2">Multiplayer Board Game</p>
        </div>

        {/* Login Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGuestLogin()}
              placeholder="Enter your name"
              className="input"
              maxLength={20}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            onClick={handleGuestLogin}
            disabled={isLoading}
            className="btn btn-primary w-full"
          >
            {isLoading ? 'Logging in...' : 'Play as Guest'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800 text-gray-400">or</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="btn btn-secondary w-full flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Features */}
        <div className="mt-8 pt-6 border-t border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="text-2xl mb-1">🎮</div>
              <div className="text-gray-400">2-4 Players</div>
            </div>
            <div>
              <div className="text-2xl mb-1">🎤</div>
              <div className="text-gray-400">Voice Chat</div>
            </div>
            <div>
              <div className="text-2xl mb-1">⚡</div>
              <div className="text-gray-400">Real-time</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
