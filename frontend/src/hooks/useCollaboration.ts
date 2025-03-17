import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { useAuthStore } from '@/stores/authStore';
import { getRandomUserColor } from '@/components/editor/CollaborationIndicators';

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  lastSeen: number;
}

export interface CollaborationCursor {
  userId: string;
  userName: string;
  position: {
    x: number;
    y: number;
    blockId?: string;
  };
  color: string;
  lastUpdate: number;
}

export const useCollaboration = (pageId: string | null) => {
  const { user } = useAuthStore();
  const { subscribePage, sendCursorPosition } = useWebSocket();

  const [onlineUsers, setOnlineUsers] = useState<CollaborationUser[]>([]);
  const [cursors, setCursors] = useState<CollaborationCursor[]>([]);
  const [userColors, setUserColors] = useState<Record<string, string>>({});

  // Subscribe to WebSocket events for this page
  useEffect(() => {
    if (!pageId || !user) return;

    // Subscribe to the page
    subscribePage(pageId);

    // Add current user to online users
    const currentUserColor = getRandomUserColor();
    setUserColors(prev => ({ ...prev, [user.id]: currentUserColor }));

    setOnlineUsers(prev => {
      const existingUser = prev.find(u => u.id === user.id);
      if (existingUser) {
        return prev.map(u =>
          u.id === user.id
            ? { ...u, lastSeen: Date.now() }
            : u
        );
      } else {
        return [
          ...prev,
          {
            id: user.id,
            name: user.name,
            color: currentUserColor,
            lastSeen: Date.now()
          }
        ];
      }
    });

    // Setup document mouse move listener
    const handleMouseMove = (e: MouseEvent) => {
      if (!user) return;

      // Throttle cursor updates (send max once every 100ms)
      const now = Date.now();
      if (!handleMouseMove.lastSent || now - handleMouseMove.lastSent > 100) {
        sendCursorPosition(pageId, {
          x: e.clientX,
          y: e.clientY
        });
        handleMouseMove.lastSent = now;
      }
    };

    // Add type definition to handle throttling
    handleMouseMove.lastSent = 0;

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [pageId, user, subscribePage, sendCursorPosition]);

  // Handle user joined event
  const handleUserJoined = useCallback((userData: { id: string, name: string }) => {
    setOnlineUsers(prev => {
      const existingUser = prev.find(u => u.id === userData.id);
      if (existingUser) {
        return prev.map(u =>
          u.id === userData.id
            ? { ...u, lastSeen: Date.now() }
            : u
        );
      } else {
        // Generate a color for this user if we don't have one
        let color = userColors[userData.id];
        if (!color) {
          color = getRandomUserColor();
          setUserColors(prev => ({ ...prev, [userData.id]: color }));
        }

        return [
          ...prev,
          {
            id: userData.id,
            name: userData.name,
            color,
            lastSeen: Date.now()
          }
        ];
      }
    });
  }, [userColors]);

  // Handle user left event
  const handleUserLeft = useCallback((userData: { id: string }) => {
    setOnlineUsers(prev => prev.filter(u => u.id !== userData.id));
    setCursors(prev => prev.filter(c => c.userId !== userData.id));
  }, []);

  // Handle cursor position update event
  const handleCursorPosition = useCallback((data: {
    user_id: string,
    user_name: string,
    position: { x: number, y: number, block_id?: string }
  }) => {
    // Ignore our own cursor
    if (user && data.user_id === user.id) return;

    // Generate a color for this user if we don't have one
    let color = userColors[data.user_id];
    if (!color) {
      color = getRandomUserColor();
      setUserColors(prev => ({ ...prev, [data.user_id]: color }));
    }

    setCursors(prev => {
      const existingCursor = prev.find(c => c.userId === data.user_id);
      if (existingCursor) {
        return prev.map(c =>
          c.userId === data.user_id
            ? {
                ...c,
                position: data.position,
                lastUpdate: Date.now()
              }
            : c
        );
      } else {
        return [
          ...prev,
          {
            userId: data.user_id,
            userName: data.user_name,
            position: data.position,
            color,
            lastUpdate: Date.now()
          }
        ];
      }
    });
  }, [user, userColors]);

  // Clean up stale users and cursors periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      // Remove users that haven't been seen in 30 seconds
      setOnlineUsers(prev =>
        prev.filter(user => now - user.lastSeen < 30000)
      );

      // Remove cursors that haven't been updated in 10 seconds
      setCursors(prev =>
        prev.filter(cursor => now - cursor.lastUpdate < 10000)
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return {
    onlineUsers,
    cursors,
    handleUserJoined,
    handleUserLeft,
    handleCursorPosition
  };
};

export default useCollaboration;
