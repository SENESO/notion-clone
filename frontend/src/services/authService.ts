import axios from 'axios';
import { User } from '@/stores/authStore';

const API_URL = '/api';

// Create API instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth-storage')
    ? JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token
    : null;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

interface AuthResponse {
  status: string;
  message: string;
  user: User;
  token: string;
}

export const AuthService = {
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    try {
      const response = await api.post<AuthResponse>('/auth/login', { email, password });

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Login failed');
      }

      return { user: response.data.user, token: response.data.token };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Login failed');
      }
      throw error;
    }
  },

  async register(name: string, email: string, password: string): Promise<{ user: User; token: string }> {
    try {
      const response = await api.post<AuthResponse>('/auth/register', {
        name,
        email,
        password,
      });

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Registration failed');
      }

      return { user: response.data.user, token: response.data.token };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Registration failed');
      }
      throw error;
    }
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get<{ status: string; user: User }>('/users/me');

    if (response.data.status !== 'success') {
      throw new Error('Failed to get user data');
    }

    return response.data.user;
  },

  logout(): void {
    api.post('/auth/logout').catch(console.error);
  },
};

export default api;
