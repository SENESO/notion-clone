import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebSocket } from '@/hooks/useWebSocket';
import { usePagesStore } from '@/stores/pagesStore';
import { useBlocksStore } from '@/stores/blocksStore';
import { useCollaboration } from '@/hooks/useCollaboration';
import BlockEditor from '@/components/editor/BlockEditor';
import PageHeader from '@/components/editor/PageHeader';
import CollaborationIndicators from '@/components/editor/CollaborationIndicators';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PlusIcon, ArrowLeftIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PageView() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { currentPage, fetchPage, updatePage } = usePagesStore();
  const { blocks, pageBlocks, fetchBlocksForPage, createBlock } = useBlocksStore();
  const { subscribePage, sendPageUpdate, sendBlockUpdate } = useWebSocket();

  // Initialize collaboration state
  const {
    onlineUsers,
    cursors,
    handleUserJoined,
    handleUserLeft,
    handleCursorPosition
  } = useCollaboration(pageId || null);

  // Fetch page data on mount
  useEffect(() => {
    if (!pageId) return;

    const loadPage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch page with blocks
        await fetchPage(pageId);

        // Subscribe to real-time updates
        subscribePage(pageId);

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading page:', err);
        setError('Failed to load page. It may have been deleted or you don\'t have access.');
        setIsLoading(false);
      }
    };

    loadPage();

    // Setup WebSocket event handlers for collaboration
    const handleWebSocketMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (!data.type) return;

        switch (data.type) {
          case 'user_joined':
            handleUserJoined(data.user);
            break;
          case 'user_left':
            handleUserLeft(data.user);
            break;
          case 'cursor_position':
            handleCursorPosition(data);
            break;
        }
      } catch (e) {
        console.error("Error handling WebSocket message:", e);
      }
    };

    window.addEventListener('message', handleWebSocketMessage);

    return () => {
      window.removeEventListener('message', handleWebSocketMessage);
    };
  }, [pageId, fetchPage, subscribePage, handleUserJoined, handleUserLeft, handleCursorPosition]);

  // Handle page title update
  const handleUpdateTitle = async (title: string) => {
    if (!pageId || !currentPage) return;

    try {
      const updatedPage = await updatePage(pageId, { title });

      // Send real-time update
      sendPageUpdate(pageId, { title });

      return updatedPage;
    } catch (err) {
      console.error('Error updating title:', err);
      toast.error('Failed to update title');
      return null;
    }
  };

  // Handle creating a new block
  const handleCreateBlock = async (type: string, position?: number) => {
    if (!pageId || !currentPage) return;

    try {
      // Default content based on block type
      const content = {
        text: type === 'heading-1' ? 'Heading 1' :
              type === 'heading-2' ? 'Heading 2' :
              type === 'heading-3' ? 'Heading 3' :
              type === 'bullet-list' ? 'List item' :
              type === 'numbered-list' ? 'Numbered item' :
              type === 'todo' ? 'To-do item' :
              type === 'toggle' ? 'Toggle heading' :
              type === 'code' ? 'Code block' :
              type === 'quote' ? 'Quote' :
              type === 'callout' ? 'Callout' :
              type === 'divider' ? '' :
              type === 'image' ? { src: '', alt: '' } :
              type === 'table' ? { rows: 3, cols: 3, content: [] } :
              'Type something...'
      };

      // Calculate position
      const pos = position !== undefined ? position :
                 (pageBlocks[pageId]?.length ?? 0);

      const newBlock = await createBlock({
        type,
        content,
        position: pos,
        page_id: pageId
      });

      return newBlock;
    } catch (err) {
      console.error('Error creating block:', err);
      toast.error('Failed to create block');
      return null;
    }
  };

  // If page not found or error loading
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="mx-auto max-w-md text-center">
          <h2 className="mb-2 text-2xl font-bold">Page Not Found</h2>
          <p className="mb-6 text-muted-foreground">{error}</p>
          <Button onClick={() => navigate('/')}>
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading || !currentPage) {
    return (
      <div className="animate-in fade-in-50 max-w-4xl mx-auto w-full p-4 md:p-8 space-y-8">
        <Skeleton className="h-10 w-[70%]" />
        <div className="space-y-4">
          <Skeleton className="h-[28px] w-full" />
          <Skeleton className="h-[28px] w-[90%]" />
          <Skeleton className="h-[28px] w-[80%]" />
        </div>
      </div>
    );
  }

  // Get page blocks
  const pageContent = pageBlocks[pageId] || [];

  return (
    <div className={cn(
      "animate-in fade-in-50 max-w-4xl mx-auto w-full",
      "px-4 py-6 md:px-8 md:py-12",
      "flex flex-col gap-4"
    )}>
      {/* Collaboration UI */}
      {pageId && (
        <CollaborationIndicators
          pageId={pageId}
          onlineUsers={onlineUsers}
          cursors={cursors}
        />
      )}

      {/* Page Header */}
      <PageHeader
        page={currentPage}
        onUpdateTitle={handleUpdateTitle}
      />

      {/* Blocks */}
      <div className="mt-6 space-y-1">
        {pageContent.length === 0 ? (
          // Empty state - no blocks yet
          <div className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">This page is empty</p>
            <Button
              onClick={() => handleCreateBlock('paragraph')}
              variant="outline"
              size="sm"
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Add a block
            </Button>
          </div>
        ) : (
          // Render blocks
          pageContent.map((block) => (
            <BlockEditor
              key={block.id}
              block={block}
              sendBlockUpdate={sendBlockUpdate}
              onCreateBlock={handleCreateBlock}
            />
          ))
        )}

        {/* Add new block button */}
        {pageContent.length > 0 && (
          <div className="flex justify-center py-4">
            <Button
              onClick={() => handleCreateBlock('paragraph')}
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 opacity-60 hover:opacity-100"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Add block</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
