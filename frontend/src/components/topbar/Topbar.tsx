import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspacesStore } from '@/stores/workspacesStore';
import { usePagesStore } from '@/stores/pagesStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MenuIcon, Search, LogOut, Settings, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface TopbarProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export default function Topbar({ onToggleSidebar, sidebarOpen }: TopbarProps) {
  const { user, logout } = useAuthStore();
  const { currentWorkspace } = useWorkspacesStore();
  const { currentPage } = usePagesStore();

  const [searchDialogOpen, setSearchDialogOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const pageTitle = currentPage?.title || (currentWorkspace ? `${currentWorkspace.name} Dashboard` : 'Dashboard');

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background px-4">
      <Button
        variant="ghost"
        size="icon"
        className="mr-2 md:hidden"
        onClick={onToggleSidebar}
      >
        <MenuIcon className="h-5 w-5" />
        <span className="sr-only">Toggle sidebar</span>
      </Button>

      <div className={cn("ml-0 transition-all duration-300 md:ml-60", !sidebarOpen && "md:ml-0")}>
        <h1 className="text-lg font-medium">{pageTitle}</h1>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="hidden sm:flex">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Search</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder="Search pages..."
                className="w-full"
                autoFocus
              />
              <div className="max-h-[300px] overflow-auto">
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Start typing to search...
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button
          variant="outline"
          size="icon"
          className="sm:hidden"
          onClick={() => setSearchDialogOpen(true)}
        >
          <Search className="h-4 w-4" />
          <span className="sr-only">Search</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                {user?.profile_picture ? (
                  <AvatarImage src={user.profile_picture} alt={user.name} />
                ) : null}
                <AvatarFallback>{user ? getInitials(user.name) : 'U'}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
