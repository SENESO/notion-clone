import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// Constants
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
const WS_BASE_URL = process.env.REACT_APP_WS_URL || `ws://${window.location.host}:8080`;

// Create a configured axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds
});

// Add a request interceptor to inject authentication token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth-storage')
      ? JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token
      : null;

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle token expiration/401 errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Get token from local storage
        const storageData = localStorage.getItem('auth-storage');
        if (!storageData) throw new Error('No auth data found');

        const { state } = JSON.parse(storageData);
        if (!state?.token) throw new Error('No token found');

        // Try to refresh the token
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          token: state.token
        });

        // If token refresh was successful
        if (response.data.status === 'success' && response.data.token) {
          // Update token in localStorage
          const newState = { ...state, token: response.data.token };
          localStorage.setItem('auth-storage', JSON.stringify({ state: newState }));

          // Update header for the original request and retry
          originalRequest.headers['Authorization'] = `Bearer ${response.data.token}`;
          return axios(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);

        // Clear auth data and redirect to login
        localStorage.removeItem('auth-storage');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API service object with typed methods
const apiService = {
  // Authentication
  auth: {
    login: (email: string, password: string) =>
      api.post('/auth/login', { email, password }),

    register: (name: string, email: string, password: string) =>
      api.post('/auth/register', { name, email, password }),

    logout: () =>
      api.post('/auth/logout'),

    refresh: (token: string) =>
      api.post('/auth/refresh', { token }),
  },

  // User management
  users: {
    getCurrentUser: () =>
      api.get('/users/me'),

    getUser: (id: string) =>
      api.get(`/users/${id}`),

    updateUser: (id: string, data: any) =>
      api.put(`/users/${id}`, data),

    deleteUser: (id: string) =>
      api.delete(`/users/${id}`),
  },

  // Workspace management
  workspaces: {
    getAll: () =>
      api.get('/workspaces'),

    create: (data: { name: string, description?: string, icon?: string }) =>
      api.post('/workspaces', data),

    getById: (id: string) =>
      api.get(`/workspaces/${id}`),

    update: (id: string, data: any) =>
      api.put(`/workspaces/${id}`, data),

    delete: (id: string) =>
      api.delete(`/workspaces/${id}`),
  },

  // Page management
  pages: {
    getAll: (params?: { workspace_id?: string, parent_id?: string }) =>
      api.get('/pages', { params }),

    create: (data: {
      title: string,
      workspace_id: string,
      parent_id?: string,
      icon?: string,
      cover?: string
    }) => api.post('/pages', data),

    getById: (id: string, params?: { include_blocks?: boolean, include_children?: boolean }) =>
      api.get(`/pages/${id}`, { params }),

    update: (id: string, data: any) =>
      api.put(`/pages/${id}`, data),

    delete: (id: string) =>
      api.delete(`/pages/${id}`),

    getBlocks: (id: string) =>
      api.get(`/pages/${id}/blocks`),
  },

  // Block management
  blocks: {
    getById: (id: string, params?: { include_children?: boolean }) =>
      api.get(`/blocks/${id}`, { params }),

    create: (data: {
      type: string,
      content: any,
      position: number,
      page_id: string,
      parent_id?: string
    }) => api.post('/blocks', data),

    update: (id: string, data: any) =>
      api.put(`/blocks/${id}`, data),

    delete: (id: string) =>
      api.delete(`/blocks/${id}`),

    createChildren: (id: string, blocks: any[]) =>
      api.post(`/blocks/${id}/children`, { blocks }),
  },

  // Database blocks
  databaseBlocks: {
    createTable: (data: {
      page_id: string,
      columns: any[],
      has_header_row?: boolean,
      parent_id?: string,
      position?: number,
      rows?: any[]
    }) => api.post('/database-blocks/table', data),

    createKanban: (data: {
      page_id: string,
      columns: any[],
      name?: string,
      parent_id?: string,
      position?: number
    }) => api.post('/database-blocks/kanban', data),

    createCalendar: (data: {
      page_id: string,
      name?: string,
      parent_id?: string,
      position?: number,
      events?: any[]
    }) => api.post('/database-blocks/calendar', data),
  },

  // File management
  files: {
    upload: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      return api.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },

    getFileUrl: (id: string) => `${API_BASE_URL}/files/${id}`,

    getThumbnailUrl: (id: string) => `${API_BASE_URL}/files/${id}/thumbnail`,

    delete: (id: string) => api.delete(`/files/${id}`),
  },

  // Search
  search: (query: string, params?: { workspace_id?: string, limit?: number, offset?: number }) =>
    api.post('/search', { query, ...params }),
};

// WebSocket connection management
export const getWebSocketUrl = (): string => {
  return WS_BASE_URL;
};

export default apiService;
