import { useAuthStore } from '../stores/authStore';

const API_URL = import.meta.env.VITE_API_URL || '';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T }> {
    const { accessToken, refreshToken, updateTokens, logout } =
      useAuthStore.getState();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (accessToken) {
      (headers as Record<string, string>).Authorization = `Bearer ${accessToken}`;
    }

    let response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle token refresh
    if (response.status === 401 && refreshToken) {
      try {
        const refreshResponse = await fetch(`${this.baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const { data } = await refreshResponse.json();
          updateTokens(data.tokens.accessToken, data.tokens.refreshToken);

          // Retry original request
          (headers as Record<string, string>).Authorization = `Bearer ${data.tokens.accessToken}`;
          response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers,
          });
        } else {
          logout();
          throw new Error('Session expired');
        }
      } catch {
        logout();
        throw new Error('Session expired');
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint);
  }

  post<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  put<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient(API_URL);
