import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { HomePage } from './pages/HomePage';
import { LobbyPage } from './pages/LobbyPage';
import { GamePage } from './pages/GamePage';
import { AuthCallback } from './pages/AuthCallback';
import { ErrorBoundary } from './components/ErrorBoundary';

export function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/lobby"
            element={isAuthenticated ? <LobbyPage /> : <Navigate to="/" />}
          />
          <Route
            path="/game/:roomId"
            element={isAuthenticated ? <GamePage /> : <Navigate to="/" />}
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </ErrorBoundary>
  );
}
