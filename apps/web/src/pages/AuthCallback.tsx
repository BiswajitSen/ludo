import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';

export function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');

    if (accessToken && refreshToken) {
      // Fetch user data with the token
      api
        .get('/api/auth/me')
        .then((response: any) => {
          const { user } = response.data.data;
          setAuth(user, accessToken, refreshToken);
          navigate('/lobby');
        })
        .catch(() => {
          navigate('/?error=auth_failed');
        });
    } else {
      navigate('/?error=no_token');
    }
  }, [searchParams, navigate, setAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-400">Completing sign in...</p>
      </div>
    </div>
  );
}
