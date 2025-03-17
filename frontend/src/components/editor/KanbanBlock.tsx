import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, MoreHorizontal, X, CalendarIcon, User2 } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useBlocksStore } from '@/stores/blocksStore';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface KanbanColumn {
  id: string;
  content: {
    title: string;
    color?: string;
  };
  children: KanbanItem[];
}

interface KanbanItem {
  id: string;
  content: {
    title: string;
    description?: string;
    color?: string;
    due_date?: string;
    assigned_to?: string;
  };
}

interface KanbanBlockProps {
  id: string;
  pageId: string;
  content: {
    name: string;
    item_property: string;
  };
  children: KanbanColumn[];
}

export const KanbanBlock: React.FC<KanbanBlockProps> = ({ id, pageId, content, children }) => {
  const { updateBlock, deleteBlock } = useBlocksStore();
  const { sendBlockUpdate } = useWebSocket();

  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [editingItem, setEditingItem] = useState<KanbanItem | null>(null);
  const [editedItem, setEditedItem] = useState<Partial<KanbanItem['content']>>({});

  // Extract columns and items
  const columns = children || [];

  // Handle adding a new column
  const handleAddColumn = () => {
    if (!newColumnTitle.trim()) return;

    // In a real app, this would call an API to create a new column block
    console.log('Add column with title:', newColumnTitle);

    // Reset form
    setNewColumnTitle('');
    setAddingColumn(false);
  };

  // Handle adding a new item to a column
  const handleAddItem = (columnId: string) => {
    // In a real app, this would call an API to create a new kanban item block
    console.log('Add item to column:', columnId);
  };

  // Handle saving edited item
  const handleSaveItem = () => {
    if (!editingItem || !editedItem.title?.trim()) return;

    // Find the block ID of the specific item
    const updatedContent = {
      ...editingItem.content,
      ...editedItem
    };

    // Update local state
    updateBlock(editingItem.id, updatedContent);

    // Send update to WebSocket
    sendBlockUpdate(pageId, editingItem.id, updatedContent);

    // Reset form
    setEditingItem(null);
    setEditedItem({});
  };

  const getColumnColorClass = (color?: string) => {
    if (!color) return 'bg-muted/20';

    switch (color) {
      case 'red': return 'bg-red-100 dark:bg-red-900/30';
      case 'orange': return 'bg-orange-100 dark:bg-orange-900/30';
      case 'yellow': return 'bg-yellow-100 dark:bg-yellow-900/30';
      case 'green': return 'bg-green-100 dark:bg-green-900/30';
      case 'blue': return 'bg-blue-100 dark:bg-blue-900/30';
      case 'purple': return 'bg-purple-100 dark:bg-purple-900/30';
      default: return 'bg-muted/20';
    }
  };

  const getItemColorClass = (color?: string) => {
    if (!color) return 'border-l-muted';

    switch (color) {
      case 'red': return 'border-l-red-500';
      case 'orange': return 'border-l-orange-500';
      case 'yellow': return 'border-l-yellow-500';
      case 'green': return 'border-l-green-500';
      case 'blue': return 'border-l-blue-500';
      case 'purple': return 'border-l-purple-500';
      default: return 'border-l-muted';
    }
  };

  return (
    <div className="my-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">{content.name || 'Kanban Board'}</h3>
        <Button variant="outline" size="sm" onClick={() => setAddingColumn(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Column
        </Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(column => (
          <div key={column.id} className="flex-shrink-0 w-72">
            <Card>
              <CardHeader className={`py-3 px-4 ${getColumnColorClass(column.content.color)}`}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{column.content.title}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-2">
                <div className="space-y-2">
                  {column.children?.map(item => (
                    <Card
                      key={item.id}
                      className={`border-l-4 shadow-sm hover:shadow ${getItemColorClass(item.content.color)}`}
                      onClick={() => {
                        setEditingItem(item);
                        setEditedItem({ ...item.content });
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="font-medium mb-1">{item.content.title}</div>
                        {item.content.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {item.content.description}
                          </p>
                        )}

                        {(item.content.due_date || item.content.assigned_to) && (
                          <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                            {item.content.due_date && (
                              <div className="flex items-center">
                                <CalendarIcon className="w-3 h-3 mr-1" />
                                {new Date(item.content.due_date).toLocaleDateString()}
                              </div>
                            )}
                            {item.content.assigned_to && (
                              <div className="flex items-center">
                                <User2 className="w-3 h-3 mr-1" />
                                {item.content.assigned_to}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  <Button
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground text-sm"
                    onClick={() => handleAddItem(column.id)}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Item
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}

        {addingColumn && (
          <div className="flex-shrink-0 w-72">
            <Card>
              <CardHeader className="py-3 px-4 bg-muted/20">
                <div className="flex items-center">
                  <Input
                    placeholder="Column title"
                    value={newColumnTitle}
                    onChange={(e) => setNewColumnTitle(e.target.value)}
                    className="h-7 text-sm"
                    autoFocus
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 ml-1" onClick={() => setAddingColumn(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-2">
                <Button
                  variant="default"
                  className="w-full text-sm"
                  onClick={handleAddColumn}
                  disabled={!newColumnTitle.trim()}
                >
                  Add Column
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Edit item dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={editedItem.title || ''}
                onChange={(e) => setEditedItem({...editedItem, title: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={editedItem.description || ''}
                onChange={(e) => setEditedItem({...editedItem, description: e.target.value})}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Due Date</label>
                <Input
                  type="date"
                  value={editedItem.due_date?.split('T')[0] || ''}
                  onChange={(e) => setEditedItem({...editedItem, due_date: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Assigned To</label>
                <Input
                  value={editedItem.assigned_to || ''}
                  onChange={(e) => setEditedItem({...editedItem, assigned_to: e.target.value})}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
            <Button onClick={handleSaveItem} disabled={!editedItem.title?.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KanbanBlock;
