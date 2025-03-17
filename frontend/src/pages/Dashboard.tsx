import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspacesStore } from '@/stores/workspacesStore';
import { usePagesStore } from '@/stores/pagesStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusIcon, FileTextIcon, LayersIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

// Form validation schema for new page
const newPageSchema = z.object({
  title: z.string().min(1, 'Title is required'),
});

type NewPageFormValues = z.infer<typeof newPageSchema>;

// Form validation schema for new workspace
const newWorkspaceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

type NewWorkspaceFormValues = z.infer<typeof newWorkspaceSchema>;

export default function Dashboard() {
  const navigate = useNavigate();
  const { workspaces, currentWorkspace, fetchWorkspaces, createWorkspace, isLoading: workspacesLoading } = useWorkspacesStore();
  const { pages, fetchPages, createPage, isLoading: pagesLoading } = usePagesStore();

  const [isNewPageDialogOpen, setIsNewPageDialogOpen] = useState(false);
  const [isNewWorkspaceDialogOpen, setIsNewWorkspaceDialogOpen] = useState(false);

  // New page form
  const pageForm = useForm<NewPageFormValues>({
    resolver: zodResolver(newPageSchema),
    defaultValues: {
      title: '',
    },
  });

  // New workspace form
  const workspaceForm = useForm<NewWorkspaceFormValues>({
    resolver: zodResolver(newWorkspaceSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  // Fetch workspaces on mount
  useEffect(() => {
    fetchWorkspaces().catch(console.error);
  }, [fetchWorkspaces]);

  // Fetch pages when current workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      fetchPages(currentWorkspace.id).catch(console.error);
    }
  }, [currentWorkspace, fetchPages]);

  // Handle page creation
  const handleCreatePage = async (data: NewPageFormValues) => {
    if (!currentWorkspace) {
      toast.error('Please select a workspace first');
      return;
    }

    try {
      const newPage = await createPage({
        title: data.title,
        workspace_id: currentWorkspace.id,
      });

      setIsNewPageDialogOpen(false);
      pageForm.reset();

      // Navigate to the new page
      navigate(`/page/${newPage.id}`);
    } catch (error) {
      console.error('Error creating page:', error);
    }
  };

  // Handle workspace creation
  const handleCreateWorkspace = async (data: NewWorkspaceFormValues) => {
    try {
      await createWorkspace({
        name: data.name,
        description: data.description,
      });

      setIsNewWorkspaceDialogOpen(false);
      workspaceForm.reset();
    } catch (error) {
      console.error('Error creating workspace:', error);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Workspaces</h2>
          <Dialog open={isNewWorkspaceDialogOpen} onOpenChange={setIsNewWorkspaceDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <PlusIcon className="mr-2 h-4 w-4" />
                New Workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Workspace</DialogTitle>
                <DialogDescription>
                  Create a new workspace to organize your pages.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={workspaceForm.handleSubmit(handleCreateWorkspace)}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" {...workspaceForm.register('name')} />
                    {workspaceForm.formState.errors.name && (
                      <p className="text-sm text-destructive">{workspaceForm.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Input id="description" {...workspaceForm.register('description')} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsNewWorkspaceDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Workspace</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspacesLoading ? (
            // Workspace skeletons
            Array(3).fill(0).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="p-4">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))
          ) : workspaces.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center p-6">
                <LayersIcon className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="mb-4 text-center text-muted-foreground">
                  You don't have any workspaces yet.
                </p>
                <Button onClick={() => setIsNewWorkspaceDialogOpen(true)}>
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Create Workspace
                </Button>
              </CardContent>
            </Card>
          ) : (
            // Workspace cards
            workspaces.map((workspace) => (
              <Card key={workspace.id} className={workspace.id === currentWorkspace?.id ? 'border-primary' : ''}>
                <CardHeader className="p-4">
                  <CardTitle>{workspace.name}</CardTitle>
                  {workspace.description && (
                    <CardDescription>{workspace.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-sm text-muted-foreground">
                    Owner: {workspace.owner.name}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      {currentWorkspace && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Pages in {currentWorkspace.name}</h2>
            <Dialog open={isNewPageDialogOpen} onOpenChange={setIsNewPageDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <PlusIcon className="mr-2 h-4 w-4" />
                  New Page
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Page</DialogTitle>
                  <DialogDescription>
                    Create a new page in the "{currentWorkspace.name}" workspace.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={pageForm.handleSubmit(handleCreatePage)}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input id="title" {...pageForm.register('title')} />
                      {pageForm.formState.errors.title && (
                        <p className="text-sm text-destructive">{pageForm.formState.errors.title.message}</p>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsNewPageDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Page</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pagesLoading ? (
              // Page skeletons
              Array(3).fill(0).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader className="p-4">
                    <Skeleton className="h-4 w-2/3" />
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              ))
            ) : pages.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <FileTextIcon className="mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="mb-4 text-center text-muted-foreground">
                    No pages in this workspace yet.
                  </p>
                  <Button onClick={() => setIsNewPageDialogOpen(true)}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Create Page
                  </Button>
                </CardContent>
              </Card>
            ) : (
              // Page cards
              pages.map((page) => (
                <Card
                  key={page.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => navigate(`/page/${page.id}`)}
                >
                  <CardHeader className="p-4">
                    <CardTitle className="flex items-center">
                      {page.icon && <span className="mr-2">{page.icon}</span>}
                      {page.title}
                    </CardTitle>
                  </CardHeader>
                  <CardFooter className="border-t p-4 text-sm text-muted-foreground">
                    Last updated: {new Date(page.updated_at).toLocaleDateString()}
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
