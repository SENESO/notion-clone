import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';

interface CollaborationCursor {
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

interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  lastSeen: number;
}

interface CollaborationIndicatorsProps {
  pageId: string;
  onlineUsers: CollaborationUser[];
  cursors: CollaborationCursor[];
}

export const CollaborationIndicators: React.FC<CollaborationIndicatorsProps> = ({
  pageId,
  onlineUsers,
  cursors
}) => {
  const { user } = useAuth();

  // Filter out current user
  const otherUsers = onlineUsers.filter(u => u.id !== user?.id);
  const otherCursors = cursors.filter(c => c.userId !== user?.id);

  // Auto-expire cursors after 10 seconds of inactivity
  const [visibleCursors, setVisibleCursors] = useState<CollaborationCursor[]>(otherCursors);

  useEffect(() => {
    // Check for expired cursors every second
    const interval = setInterval(() => {
      const now = Date.now();
      setVisibleCursors(prev =>
        prev.filter(cursor => now - cursor.lastUpdate < 10000)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Update visible cursors when props change
    setVisibleCursors(otherCursors.filter(cursor => {
      const now = Date.now();
      return now - cursor.lastUpdate < 10000;
    }));
  }, [otherCursors]);

  return (
    <>
      {/* User Presence Indicator */}
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center space-x-2 bg-background/90 backdrop-blur-sm border rounded-full px-3 py-1 shadow-md">
          {otherUsers.length > 0 ? (
            <>
              <div className="flex -space-x-2">
                {otherUsers.slice(0, 3).map(user => (
                  <div
                    key={user.id}
                    className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-background"
                    style={{ backgroundColor: user.color || '#6366f1' }}
                  >
                    <span className="text-white text-xs font-medium">
                      {user.name.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
              <span className="text-sm font-medium">
                {otherUsers.length > 3
                  ? `${otherUsers.slice(0, 3).map(u => u.name.split(' ')[0]).join(', ')} +${otherUsers.length - 3} more`
                  : otherUsers.map(u => u.name.split(' ')[0]).join(', ')}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Just you</span>
          )}
        </div>
      </div>

      {/* Cursor Indicators */}
      <AnimatePresence>
        {visibleCursors.map(cursor => (
          <motion.div
            key={cursor.userId}
            className="fixed z-50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, x: cursor.position.x, y: cursor.position.y }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Cursor */}
            <svg
              width="24"
              height="36"
              viewBox="0 0 24 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ color: cursor.color || '#6366f1' }}
            >
              <path
                d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.0114686 17.248L0.000335449 17.2577V17.271V32.0001V32.9196L0.707122 32.3695L8.75193 25.9545L12.979 35.6011L14.1989 34.8564L14.1747 33.9757L9.99854 12.9485L9.84509 12.3673H9.24526H5.65376Z"
                fill="currentColor"
                stroke="white"
              />
            </svg>

            {/* Username Tooltip */}
            <div
              className="absolute left-6 top-0 bg-background border rounded px-2 py-1 text-xs shadow whitespace-nowrap"
              style={{ borderColor: cursor.color || '#6366f1' }}
            >
              {cursor.userName}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </>
  );
};

// Helper function to generate a random color for new users
export const getRandomUserColor = (): string => {
  const colors = [
    '#f43f5e', // rose
    '#ec4899', // pink
    '#8b5cf6', // violet
    '#6366f1', // indigo
    '#3b82f6', // blue
    '#06b6d4', // cyan
    '#10b981', // emerald
    '#84cc16', // lime
    '#eab308', // yellow
    '#f97316', // orange
  ];

  return colors[Math.floor(Math.random() * colors.length)];
};

export default CollaborationIndicators;
