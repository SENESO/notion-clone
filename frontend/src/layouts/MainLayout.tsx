import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/sidebar/Sidebar';
import Topbar from '@/components/topbar/Topbar';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { token } = useAuthStore();

  // Initialize WebSocket connection
  useWebSocket();

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (!token) return null;

  return (
    <div className="flex h-screen flex-col">
      <Topbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className={cn("flex-1 transition-all duration-200",
          sidebarOpen ? "md:ml-60" : "md:ml-0"
        )}>
          <div className="h-full overflow-auto p-4">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
