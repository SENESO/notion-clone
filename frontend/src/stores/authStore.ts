import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiService from '@/services/api';

export interface User {
  id: string;
  name: string;
  email: string;
  profile_picture?: string;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  initialized: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      initialized: false,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true, error: null });

          const response = await apiService.auth.login(email, password);

          if (response.data.status !== 'success') {
            throw new Error(response.data.message || 'Failed to login');
          }

          set({
            token: response.data.token,
            user: response.data.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          set({
            error: error.response?.data?.message || error.message || 'Failed to login',
            isLoading: false,
          });
          throw error;
        }
      },

      register: async (name: string, email: string, password: string) => {
        try {
          set({ isLoading: true, error: null });

          const response = await apiService.auth.register(name, email, password);

          if (response.data.status !== 'success') {
            throw new Error(response.data.message || 'Failed to register');
          }

          set({
            token: response.data.token,
            user: response.data.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          set({
            error: error.response?.data?.message || error.message || 'Failed to register',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: () => {
        try {
          apiService.auth.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({
            token: null,
            user: null,
            isAuthenticated: false,
          });
        }
      },

      checkAuth: async () => {
        const { token } = get();
        try {
          set({ isLoading: true });

          if (!token) {
            set({ initialized: true, isLoading: false });
            return;
          }

          // Fetch current user information
          const response = await apiService.users.getCurrentUser();

          if (response.data.status !== 'success') {
            throw new Error('Authentication failed');
          }

          set({
            user: response.data.user,
            isAuthenticated: true,
            initialized: true,
            isLoading: false,
          });
        } catch (error) {
          console.error('Auth check error:', error);
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            initialized: true,
            isLoading: false,
          });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
    }
  )
);

// Initialize auth state
setTimeout(() => {
  useAuthStore.getState().checkAuth();
}, 0);
