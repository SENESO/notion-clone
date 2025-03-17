import { create } from 'zustand';
import apiService from '@/services/api';

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface WorkspacesState {
  workspaces: Record<string, Workspace>;
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;

  // Fetch all workspaces
  fetchWorkspaces: () => Promise<Workspace[]>;

  // Fetch a single workspace
  fetchWorkspace: (id: string) => Promise<Workspace>;

  // Create a new workspace
  createWorkspace: (data: {
    name: string,
    description?: string,
    icon?: string
  }) => Promise<Workspace>;

  // Update a workspace
  updateWorkspace: (id: string, data: Partial<Workspace>) => Promise<Workspace>;

  // Delete a workspace
  deleteWorkspace: (id: string) => Promise<void>;

  // Set current workspace
  setCurrentWorkspace: (workspace: Workspace | null) => void;

  // Clear errors
  clearError: () => void;
}

export const useWorkspacesStore = create<WorkspacesState>((set, get) => ({
  workspaces: {},
  currentWorkspace: null,
  isLoading: false,
  error: null,

  fetchWorkspaces: async () => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiService.workspaces.getAll();

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to fetch workspaces');
      }

      const workspaces = response.data.workspaces || [];

      // Create a map of workspaces by ID for easier lookup
      const workspacesMap = workspaces.reduce((acc: Record<string, Workspace>, workspace: Workspace) => {
        acc[workspace.id] = workspace;
        return acc;
      }, {});

      set({
        workspaces: workspacesMap,
        isLoading: false
      });

      return workspaces;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || error.message || 'Failed to fetch workspaces'
      });
      throw error;
    }
  },

  fetchWorkspace: async (id: string) => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiService.workspaces.getById(id);

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to fetch workspace');
      }

      const workspace = response.data.workspace;

      set(state => ({
        workspaces: {
          ...state.workspaces,
          [workspace.id]: workspace
        },
        isLoading: false
      }));

      return workspace;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || error.message || 'Failed to fetch workspace'
      });
      throw error;
    }
  },

  createWorkspace: async (data) => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiService.workspaces.create(data);

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to create workspace');
      }

      const workspace = response.data.workspace;

      set(state => ({
        workspaces: {
          ...state.workspaces,
          [workspace.id]: workspace
        },
        currentWorkspace: workspace,
        isLoading: false
      }));

      return workspace;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || error.message || 'Failed to create workspace'
      });
      throw error;
    }
  },

  updateWorkspace: async (id: string, data: Partial<Workspace>) => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiService.workspaces.update(id, data);

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to update workspace');
      }

      const workspace = response.data.workspace;

      set(state => {
        const isCurrentWorkspace = state.currentWorkspace?.id === id;

        return {
          workspaces: {
            ...state.workspaces,
            [workspace.id]: workspace
          },
          currentWorkspace: isCurrentWorkspace ? workspace : state.currentWorkspace,
          isLoading: false
        };
      });

      return workspace;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || error.message || 'Failed to update workspace'
      });
      throw error;
    }
  },

  deleteWorkspace: async (id: string) => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiService.workspaces.delete(id);

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to delete workspace');
      }

      set(state => {
        const { [id]: removedWorkspace, ...remainingWorkspaces } = state.workspaces;
        const isCurrentWorkspace = state.currentWorkspace?.id === id;

        return {
          workspaces: remainingWorkspaces,
          currentWorkspace: isCurrentWorkspace ? null : state.currentWorkspace,
          isLoading: false
        };
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || error.message || 'Failed to delete workspace'
      });
      throw error;
    }
  },

  setCurrentWorkspace: (workspace) => {
    set({ currentWorkspace: workspace });
  },

  clearError: () => set({ error: null })
}));
