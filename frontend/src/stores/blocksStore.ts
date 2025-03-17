import { create } from 'zustand';
import apiService from '@/services/api';
import { toast } from 'sonner';

export interface Block {
  id: string;
  type: string;
  content: any;
  position: number;
  page_id: string;
  parent_id?: string;
  metadata?: any;
  view_type?: string;
  has_children?: boolean;
  children?: Block[];
  created_at: string;
  updated_at: string;
}

interface BlocksState {
  blocks: Record<string, Block>;
  pageBlocks: Record<string, Block[]>;
  isLoading: boolean;
  error: string | null;

  // Fetch blocks for a page
  fetchBlocksForPage: (pageId: string) => Promise<Block[]>;

  // Fetch child blocks for a parent block
  fetchBlockChildren: (blockId: string) => Promise<Block[]>;

  // Create a new block
  createBlock: (data: {
    type: string;
    content: any;
    position: number;
    page_id: string;
    parent_id?: string;
    metadata?: any;
    view_type?: string;
  }) => Promise<Block>;

  // Update a block
  updateBlock: (blockId: string, content: any) => void;

  // Delete a block
  deleteBlock: (blockId: string) => Promise<void>;

  // Clear errors
  clearError: () => void;
}

export const useBlocksStore = create<BlocksState>((set, get) => ({
  blocks: {},
  pageBlocks: {},
  isLoading: false,
  error: null,

  fetchBlocksForPage: async (pageId: string) => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiService.pages.getBlocks(pageId);

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to fetch blocks');
      }

      const blocks = response.data.blocks || [];

      // Update state
      set((state) => {
        // Create a copy of the blocks object
        const newBlocks = { ...state.blocks };

        // Add each block to the blocks record
        blocks.forEach((block: Block) => {
          newBlocks[block.id] = block;

          // Add children blocks if present
          if (block.children && block.children.length > 0) {
            block.children.forEach((child: Block) => {
              newBlocks[child.id] = child;
            });
          }
        });

        return {
          blocks: newBlocks,
          pageBlocks: {
            ...state.pageBlocks,
            [pageId]: blocks
          },
          isLoading: false
        };
      });

      return blocks;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || error.message || 'Failed to fetch blocks'
      });
      throw error;
    }
  },

  fetchBlockChildren: async (blockId: string) => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiService.blocks.getById(blockId, { include_children: true });

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to fetch block children');
      }

      const block = response.data.block;
      const children = block.children || [];

      // Update state
      set((state) => {
        // Add the parent block
        const newBlocks = {
          ...state.blocks,
          [blockId]: block
        };

        // Add child blocks
        children.forEach((child: Block) => {
          newBlocks[child.id] = child;
        });

        return {
          blocks: newBlocks,
          isLoading: false
        };
      });

      return children;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || error.message || 'Failed to fetch block children'
      });
      throw error;
    }
  },

  createBlock: async (data) => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiService.blocks.create(data);

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to create block');
      }

      const newBlock = response.data.block;

      // Update state
      set((state) => {
        // Add block to blocks record
        const newBlocks = {
          ...state.blocks,
          [newBlock.id]: newBlock
        };

        // Add block to page blocks
        const pageId = newBlock.page_id;
        const pageBlocks = state.pageBlocks[pageId] || [];

        // Sort the blocks by position
        const updatedPageBlocks = [...pageBlocks, newBlock].sort((a, b) => a.position - b.position);

        return {
          blocks: newBlocks,
          pageBlocks: {
            ...state.pageBlocks,
            [pageId]: updatedPageBlocks
          },
          isLoading: false
        };
      });

      return newBlock;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || error.message || 'Failed to create block'
      });
      throw error;
    }
  },

  updateBlock: (blockId: string, content: any) => {
    const { blocks } = get();
    const block = blocks[blockId];

    if (!block) {
      console.warn(`Block with ID ${blockId} not found, cannot update`);
      return;
    }

    try {
      // Perform optimistic update
      set((state) => {
        // Update block in blocks record
        const updatedBlock = {
          ...block,
          content: typeof content === 'object' ? content : { text: content },
          updated_at: new Date().toISOString()
        };

        // Update blocks record
        const newBlocks = {
          ...state.blocks,
          [blockId]: updatedBlock
        };

        // Update page blocks if present
        const pageId = block.page_id;
        const pageBlocks = state.pageBlocks[pageId];

        if (pageBlocks) {
          const updatedPageBlocks = pageBlocks.map(b =>
            b.id === blockId ? updatedBlock : b
          );

          return {
            blocks: newBlocks,
            pageBlocks: {
              ...state.pageBlocks,
              [pageId]: updatedPageBlocks
            }
          };
        }

        return { blocks: newBlocks };
      });

      // Make API call in background
      apiService.blocks.update(blockId, { content })
        .catch(error => {
          console.error('Error updating block:', error);
          toast.error('Failed to update block. Please try again.');

          // Revert to original if API call fails
          set((state) => ({
            blocks: {
              ...state.blocks,
              [blockId]: block
            }
          }));
        });
    } catch (error) {
      console.error('Error updating block locally:', error);
    }
  },

  deleteBlock: async (blockId: string) => {
    const { blocks } = get();
    const block = blocks[blockId];

    if (!block) {
      console.warn(`Block with ID ${blockId} not found, cannot delete`);
      return;
    }

    try {
      set({ isLoading: true, error: null });

      // Store for reversion if needed
      const originalBlock = block;
      const pageId = block.page_id;

      // Perform optimistic update
      set((state) => {
        // Remove from blocks record
        const { [blockId]: removedBlock, ...remainingBlocks } = state.blocks;

        // Remove from page blocks
        const pageBlocks = state.pageBlocks[pageId];

        if (pageBlocks) {
          const updatedPageBlocks = pageBlocks.filter(b => b.id !== blockId);

          return {
            blocks: remainingBlocks,
            pageBlocks: {
              ...state.pageBlocks,
              [pageId]: updatedPageBlocks
            },
            isLoading: true
          };
        }

        return {
          blocks: remainingBlocks,
          isLoading: true
        };
      });

      // Make API call
      const response = await apiService.blocks.delete(blockId);

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to delete block');
      }

      set({ isLoading: false });
    } catch (error: any) {
      // Restore block on failure
      set((state) => {
        const pageId = block.page_id;
        const pageBlocks = state.pageBlocks[pageId] || [];

        // Re-insert the block
        const updatedPageBlocks = [...pageBlocks, block].sort((a, b) => a.position - b.position);

        return {
          blocks: {
            ...state.blocks,
            [blockId]: block
          },
          pageBlocks: {
            ...state.pageBlocks,
            [pageId]: updatedPageBlocks
          },
          isLoading: false,
          error: error.response?.data?.message || error.message || 'Failed to delete block'
        };
      });

      toast.error('Failed to delete block. Please try again.');
      throw error;
    }
  },

  clearError: () => set({ error: null })
}));
