import { create } from 'zustand';
import apiService from '@/services/api';

export interface Page {
  id: string;
  title: string;
  icon?: string;
  cover?: string;
  workspace_id: string;
  parent_id?: string;
  is_database?: boolean;
  database_properties?: any;
  created_at: string;
  updated_at: string;
  has_children?: boolean;
  children?: Page[];
}

interface PagesState {
  pages: Record<string, Page>;
  workspacePages: Record<string, string[]>;
  currentPage: Page | null;
  isLoading: boolean;
  error: string | null;

  // Fetch all pages for a workspace
  fetchWorkspacePages: (workspaceId: string) => Promise<Page[]>;

  // Fetch a single page with its blocks
  fetchPage: (pageId: string, includeBlocks?: boolean) => Promise<Page>;

  // Create a new page
  createPage: (data: {
    title: string,
    workspace_id: string,
    parent_id?: string,
    icon?: string,
    cover?: string
  }) => Promise<Page>;

  // Update a page
  updatePage: (pageId: string, data: Partial<Page>) => Promise<Page>;

  // Delete a page
  deletePage: (pageId: string) => Promise<void>;

  // Set current page
  setCurrentPage: (page: Page | null) => void;

  // Update a page in a workspace (for real-time updates)
  updatePageInWorkspace: (pageId: string, data: Partial<Page>) => void;

  // Clear errors
  clearError: () => void;
}

export const usePagesStore = create<PagesState>((set, get) => ({
  pages: {},
  workspacePages: {},
  currentPage: null,
  isLoading: false,
  error: null,

  fetchWorkspacePages: async (workspaceId: string) => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiService.pages.getAll({ workspace_id: workspaceId });

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to fetch pages');
      }

      const pages = response.data.pages;

      // Update state
      set((state) => {
        // Create a new pages object
        const newPages = { ...state.pages };

        // Add each page to the pages record
        pages.forEach((page: Page) => {
          newPages[page.id] = page;
        });

        // Update workspace pages array
        const pageIds = pages.map((page: Page) => page.id);

        return {
          pages: newPages,
          workspacePages: {
            ...state.workspacePages,
            [workspaceId]: pageIds
          },
          isLoading: false
        };
      });

      return pages;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || error.message || 'Failed to fetch pages'
      });
      throw error;
    }
  },

  fetchPage: async (pageId: string, includeBlocks = true) => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiService.pages.getById(pageId, {
        include_blocks: includeBlocks,
        include_children: true
      });

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to fetch page');
      }

      const page = response.data.page;

      // Update state
      set((state) => ({
        pages: {
          ...state.pages,
          [pageId]: page
        },
        currentPage: page,
        isLoading: false
      }));

      return page;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || error.message || 'Failed to fetch page'
      });
      throw error;
    }
  },

  createPage: async (data) => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiService.pages.create(data);

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to create page');
      }

      const newPage = response.data.page;

      // Update state
      set((state) => {
        // Add page to pages record
        const newPages = {
          ...state.pages,
          [newPage.id]: newPage
        };

        // Add page to workspace pages array
        const workspaceId = newPage.workspace_id;
        const workspacePages = state.workspacePages[workspaceId] || [];

        return {
          pages: newPages,
          workspacePages: {
            ...state.workspacePages,
            [workspaceId]: [...workspacePages, newPage.id]
          },
          isLoading: false
        };
      });

      return newPage;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || error.message || 'Failed to create page'
      });
      throw error;
    }
  },

  updatePage: async (pageId: string, data: Partial<Page>) => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiService.pages.update(pageId, data);

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to update page');
      }

      const updatedPage = response.data.page;

      // Update state
      set((state) => {
        const currentPageUpdate = state.currentPage?.id === pageId
          ? updatedPage
          : state.currentPage;

        return {
          pages: {
            ...state.pages,
            [pageId]: updatedPage
          },
          currentPage: currentPageUpdate,
          isLoading: false
        };
      });

      return updatedPage;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || error.message || 'Failed to update page'
      });
      throw error;
    }
  },

  deletePage: async (pageId: string) => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiService.pages.delete(pageId);

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to delete page');
      }

      // Update state
      set((state) => {
        const { [pageId]: deletedPage, ...remainingPages } = state.pages;

        // Remove page from workspace pages array
        if (deletedPage) {
          const workspaceId = deletedPage.workspace_id;
          const workspacePages = state.workspacePages[workspaceId] || [];
          const updatedWorkspacePages = workspacePages.filter(id => id !== pageId);

          return {
            pages: remainingPages,
            workspacePages: {
              ...state.workspacePages,
              [workspaceId]: updatedWorkspacePages
            },
            currentPage: state.currentPage?.id === pageId ? null : state.currentPage,
            isLoading: false
          };
        }

        return {
          pages: remainingPages,
          currentPage: state.currentPage?.id === pageId ? null : state.currentPage,
          isLoading: false
        };
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || error.message || 'Failed to delete page'
      });
      throw error;
    }
  },

  setCurrentPage: (page) => {
    set({ currentPage: page });
  },

  updatePageInWorkspace: (pageId, data) => {
    set((state) => {
      // Check if the page exists in state
      if (!state.pages[pageId]) return state;

      const updatedPage = {
        ...state.pages[pageId],
        ...data,
        updated_at: new Date().toISOString()
      };

      const currentPageUpdate = state.currentPage?.id === pageId
        ? { ...state.currentPage, ...data, updated_at: updatedPage.updated_at }
        : state.currentPage;

      return {
        pages: {
          ...state.pages,
          [pageId]: updatedPage
        },
        currentPage: currentPageUpdate
      };
    });
  },

  clearError: () => set({ error: null })
}));
