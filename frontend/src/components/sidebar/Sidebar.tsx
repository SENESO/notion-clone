import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspacesStore } from '@/stores/workspacesStore';
import { usePagesStore } from '@/stores/pagesStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { PlusIcon, FileIcon, ChevronDownIcon, ChevronRightIcon, LayersIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// Form validation schema for new page
const newPageSchema = z.object({
  title: z.string().min(1, 'Title is required'),
});

type NewPageFormValues = z.infer<typeof newPageSchema>;

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const { workspaces, currentWorkspace, fetchWorkspaces, setCurrentWorkspace } = useWorkspacesStore();
  const { pages, fetchPages, createPage } = usePagesStore();

  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>({});
  const [newPageDialogOpen, setNewPageDialogOpen] = useState(false);

  const form = useForm<NewPageFormValues>({
    resolver: zodResolver(newPageSchema),
    defaultValues: {
      title: '',
    },
  });

  // Fetch workspaces on mount
  useEffect(() => {
    fetchWorkspaces().catch(console.error);
  }, [fetchWorkspaces]);

  // Initialize expanded state for current workspace
  useEffect(() => {
    if (currentWorkspace) {
      setExpandedWorkspaces(prev => ({
        ...prev,
        [currentWorkspace.id]: true
      }));
    }
  }, [currentWorkspace]);

  const toggleWorkspace = (workspaceId: string) => {
    setExpandedWorkspaces(prev => ({
      ...prev,
      [workspaceId]: !prev[workspaceId]
    }));

    const workspace = workspaces.find(w => w.id === workspaceId);
    if (workspace) {
      setCurrentWorkspace(workspace);
      // If expanding, fetch pages
      if (!expandedWorkspaces[workspaceId]) {
        fetchPages(workspaceId).catch(console.error);
      }
    }
  };

  const handleCreatePage = async (data: NewPageFormValues) => {
    if (!currentWorkspace) return;

    try {
      const newPage = await createPage({
        title: data.title,
        workspace_id: currentWorkspace.id,
      });

      setNewPageDialogOpen(false);
      form.reset();

      // Navigate to the new page
      navigate(`/page/${newPage.id}`);
    } catch (error) {
      console.error('Error creating page:', error);
    }
  };

  // Hide sidebar on mobile when clicking a link
  const handleNavigate = (path: string) => {
    navigate(path);
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r bg-card transition-transform duration-300 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center border-b px-4">
          <h2 className="text-lg font-semibold">Notion Clone</h2>
        </div>

        <div className="flex-1 overflow-auto">
          <ScrollArea className="h-full">
            <div className="space-y-4 p-4">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleNavigate('/')}
              >
                <LayersIcon className="mr-2 h-4 w-4" />
                Dashboard
              </Button>

              <Separator />

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Workspaces</h3>
                </div>

                {workspaces.length === 0 ? (
                  <div className="py-2 text-center text-sm text-muted-foreground">
                    No workspaces
                  </div>
                ) : (
                  <div className="space-y-1 pt-1">
                    {workspaces.map((workspace) => (
                      <div key={workspace.id} className="space-y-1">
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => toggleWorkspace(workspace.id)}
                        >
                          {expandedWorkspaces[workspace.id] ? (
                            <ChevronDownIcon className="mr-2 h-4 w-4" />
                          ) : (
                            <ChevronRightIcon className="mr-2 h-4 w-4" />
                          )}
                          {workspace.name}
                        </Button>

                        {expandedWorkspaces[workspace.id] && (
                          <div className="ml-4 space-y-1 pl-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start gap-2 text-muted-foreground"
                              onClick={() => setNewPageDialogOpen(true)}
                            >
                              <PlusIcon className="h-3.5 w-3.5" />
                              <span>New page</span>
                            </Button>

                            {pages
                              .filter(page => page.workspace_id === workspace.id)
                              .map(page => (
                                <Button
                                  key={page.id}
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start"
                                  onClick={() => handleNavigate(`/page/${page.id}`)}
                                >
                                  <FileIcon className="mr-2 h-3.5 w-3.5" />
                                  {page.title}
                                </Button>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-10 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* New Page Dialog */}
      <Dialog open={newPageDialogOpen} onOpenChange={setNewPageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Page</DialogTitle>
            <DialogDescription>
              Create a new page in the "{currentWorkspace?.name}" workspace.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleCreatePage)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" {...form.register('title')} />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewPageDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Page</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
