import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePagesStore } from '@/stores/pagesStore';
import { useBlocksStore } from '@/stores/blocksStore';
import { toast } from 'sonner';
import { getWebSocketUrl } from '@/services/api';

export const useWebSocket = () => {
  const { token, user } = useAuthStore();
  const { updatePageInWorkspace } = usePagesStore();
  const { updateBlock } = useBlocksStore();

  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<number | null>(null);

  // Current subscribed page
  const currentPageRef = useRef<string | null>(null);

  // Process incoming WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      if (!data.type) return;

      switch (data.type) {
        case 'auth_success':
          console.log('WebSocket authenticated successfully');
          break;

        case 'auth_error':
          console.error('WebSocket authentication error:', data.message);
          toast.error('Real-time sync error. Reconnecting...');
          break;

        case 'subscribed':
          console.log(`Subscribed to page: ${data.page_id}`);
          if (data.users && data.users.length > 0) {
            console.log('Other users on this page:', data.users);
          }

          // Dispatch event for collaboration hook
          window.dispatchEvent(
            new MessageEvent("message", {
              data: JSON.stringify({
                type: 'subscribed',
                users: data.users
              })
            })
          );
          break;

        case 'user_joined':
          toast.info(`Another user joined the document`);

          // Dispatch event for collaboration hook
          window.dispatchEvent(
            new MessageEvent("message", {
              data: JSON.stringify({
                type: 'user_joined',
                user: data.user
              })
            })
          );
          break;

        case 'user_left':
          toast.info(`A user left the document`);

          // Dispatch event for collaboration hook
          window.dispatchEvent(
            new MessageEvent("message", {
              data: JSON.stringify({
                type: 'user_left',
                user: data.user
              })
            })
          );
          break;

        case 'block_updated':
          if (data.user_id !== user?.id && data.block_id && data.content) {
            updateBlock(data.block_id, data.content);
          }
          break;

        case 'page_updated':
          if (data.user_id !== user?.id && data.page_id && data.updates) {
            updatePageInWorkspace(data.page_id, data.updates);
          }
          break;

        case 'cursor_position':
          // Dispatch event for collaboration hook
          window.dispatchEvent(
            new MessageEvent("message", {
              data: JSON.stringify({
                type: 'cursor_position',
                user_id: data.user_id,
                user_name: data.user_name,
                position: data.position
              })
            })
          );
          break;

        case 'pong':
          // Handle pong response for connection healthcheck
          break;
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  }, [user, updateBlock, updatePageInWorkspace]);

  // Subscribe to a page for real-time updates
  const subscribePage = useCallback((pageId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected. Page subscription will be attempted when connected.');
      currentPageRef.current = pageId; // Store for subscription when connected
      return;
    }

    // Unsubscribe from the previous page if needed
    if (currentPageRef.current && currentPageRef.current !== pageId) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        page_id: currentPageRef.current
      }));
    }

    // Subscribe to the new page
    wsRef.current.send(JSON.stringify({
      type: 'subscribe',
      page_id: pageId
    }));

    currentPageRef.current = pageId;
  }, []);

  // Send block update through WebSocket
  const sendBlockUpdate = useCallback((pageId: string, blockId: string, content: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({
      type: 'block_update',
      page_id: pageId,
      block_id: blockId,
      content
    }));
  }, []);

  // Send page update through WebSocket
  const sendPageUpdate = useCallback((pageId: string, updates: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({
      type: 'page_update',
      page_id: pageId,
      updates
    }));
  }, []);

  // Send cursor position for collaborative editing
  const sendCursorPosition = useCallback((pageId: string, position: { x: number, y: number, block_id?: string }) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({
      type: 'cursor_position',
      page_id: pageId,
      position
    }));
  }, []);

  // Initialize and manage WebSocket connection
  useEffect(() => {
    if (!token) return;

    // Get the WebSocket server URL
    const WS_URL = getWebSocketUrl();

    function connectWebSocket() {
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }

      // Create new WebSocket connection
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      // Connection opened
      ws.addEventListener('open', () => {
        console.log('WebSocket connection established');

        // Authenticate with JWT token
        ws.send(JSON.stringify({
          type: 'auth',
          token
        }));

        // Resubscribe to current page if any
        if (currentPageRef.current) {
          setTimeout(() => {
            subscribePage(currentPageRef.current!);
          }, 500); // Small delay to ensure auth is processed
        }

        // Start ping interval for keeping connection alive
        pingIntervalRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      });

      // Listen for messages
      ws.addEventListener('message', handleMessage);

      // Handle errors
      ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        toast.error('Connection error. Reconnecting...');
      });

      // Handle connection close
      ws.addEventListener('close', (event) => {
        console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
        clearInterval(pingIntervalRef.current || undefined);

        // Auto-reconnect unless the closure was clean
        if (event.code !== 1000) {
          console.log('Attempting to reconnect in 5 seconds...');
          setTimeout(connectWebSocket, 5000);
        }
      });
    }

    // Initial connection
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      clearInterval(pingIntervalRef.current || undefined);
      if (wsRef.current) {
        // Send unsubscribe if subscribed to a page
        if (currentPageRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'unsubscribe',
            page_id: currentPageRef.current
          }));
        }

        // Close websocket connection
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [token, handleMessage, subscribePage]);

  return {
    subscribePage,
    sendBlockUpdate,
    sendPageUpdate,
    sendCursorPosition,
    connectionStatus: wsRef.current ? wsRef.current.readyState : WebSocket.CLOSED
  };
};
