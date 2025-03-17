import React, { useState, useRef } from 'react';
import { useBlocksStore } from '@/stores/blocksStore';
import TableBlock from './TableBlock';
import KanbanBlock from './KanbanBlock';
import CalendarBlock from './CalendarBlock';
import DatabaseView from './DatabaseView';
import { PlusIcon, Trash2Icon, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Block {
  id: string;
  type: string;
  content: any;
  position: number;
  page_id: string;
  parent_id?: string;
  has_children?: boolean;
  children?: Block[];
  metadata?: any;
  view_type?: string;
}

interface BlockEditorProps {
  block: Block;
  sendBlockUpdate: (pageId: string, blockId: string, content: any) => void;
  onCreateBlock: (type: string, position?: number) => Promise<Block | null>;
}

const BlockEditor: React.FC<BlockEditorProps> = ({
  block,
  sendBlockUpdate,
  onCreateBlock,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { updateBlock, deleteBlock, fetchBlockChildren } = useBlocksStore();
  const blockRef = useRef<HTMLDivElement>(null);

  // Handle content update
  const handleContentChange = (newContent: any) => {
    updateBlock(block.id, newContent);
    sendBlockUpdate(block.page_id, block.id, newContent);
  };

  // Handle delete block
  const handleDeleteBlock = () => {
    deleteBlock(block.id);
  };

  // Load block children if needed
  React.useEffect(() => {
    if (block.has_children && (!block.children || block.children.length === 0)) {
      fetchBlockChildren(block.id);
    }
  }, [block.id, block.has_children, block.children, fetchBlockChildren]);

  // Render the appropriate block type
  const renderBlockContent = () => {
    switch (block.type) {
      case 'table':
        return (
          <TableBlock
            id={block.id}
            pageId={block.page_id}
            content={block.content}
            children={block.children || []}
          />
        );
      case 'kanban':
        return (
          <KanbanBlock
            id={block.id}
            pageId={block.page_id}
            content={block.content}
            children={block.children || []}
          />
        );
      case 'calendar':
        return (
          <CalendarBlock
            id={block.id}
            pageId={block.page_id}
            content={block.content}
            children={block.children || []}
            view_type={block.view_type as any}
          />
        );
      case 'database':
        return (
          <DatabaseView
            id={block.id}
            pageId={block.page_id}
            content={block.content}
            children={block.children || []}
            view_type={block.view_type as any}
            onViewChange={(viewType) => {
              updateBlock(block.id, { ...block.content, view_type: viewType });
              sendBlockUpdate(block.page_id, block.id, { ...block.content, view_type: viewType });
            }}
          />
        );
      default:
        return (
          <div className="p-2 border rounded">
            {JSON.stringify(block.content)}
          </div>
        );
    }
  };

  // Block add menu
  const handleAddSpecialBlock = async (type: string) => {
    const newPosition = block.position + 1;

    let content: any = {};
    let viewType: string | undefined;

    switch (type) {
      case 'table':
        content = {
          columns: [
            { id: `col-${Date.now()}-1`, name: 'Name', type: 'text' },
            { id: `col-${Date.now()}-2`, name: 'Tags', type: 'select' },
            { id: `col-${Date.now()}-3`, name: 'Date', type: 'date' }
          ],
          has_header_row: true
        };
        viewType = 'table';
        break;

      case 'kanban':
        content = {
          name: 'Kanban Board',
          item_property: 'title'
        };
        viewType = 'board';
        break;

      case 'calendar':
        content = {
          name: 'Calendar',
          date_property: 'date',
          start_date: new Date().toISOString().split('T')[0],
          time_format: '24h'
        };
        viewType = 'month';
        break;

      case 'database':
        content = {
          name: 'Database',
          columns: [
            { id: `col-${Date.now()}-1`, name: 'Title', type: 'text' },
            { id: `col-${Date.now()}-2`, name: 'Status', type: 'select' },
            { id: `col-${Date.now()}-3`, name: 'Date', type: 'date' }
          ]
        };
        viewType = 'table';
        break;
    }

    const newBlock = await onCreateBlock(type, newPosition);

    if (newBlock) {
      // Update the block with the full content and view type
      updateBlock(newBlock.id, content);
      if (viewType) {
        updateBlock(newBlock.id, { view_type: viewType });
      }

      // Send update via WebSocket
      sendBlockUpdate(block.page_id, newBlock.id, {
        ...content,
        view_type: viewType
      });
    }
  };

  return (
    <div
      ref={blockRef}
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Block controls */}
      {isHovered && (
        <div className="absolute -left-10 flex items-center h-full">
          <div className="flex flex-col items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full opacity-50 hover:opacity-100"
            >
              <GripVertical className="h-3 w-3" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full opacity-50 hover:opacity-100"
                >
                  <PlusIcon className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-48">
                <DropdownMenuItem onSelect={() => onCreateBlock('paragraph')}>
                  Text
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onCreateBlock('heading-1')}>
                  Heading 1
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onCreateBlock('heading-2')}>
                  Heading 2
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onCreateBlock('heading-3')}>
                  Heading 3
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onCreateBlock('bullet-list')}>
                  Bullet List
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onCreateBlock('numbered-list')}>
                  Numbered List
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onCreateBlock('todo')}>
                  To-do List
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => handleAddSpecialBlock('table')}>
                  Table
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleAddSpecialBlock('kanban')}>
                  Kanban Board
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleAddSpecialBlock('calendar')}>
                  Calendar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleAddSpecialBlock('database')}>
                  Database
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full opacity-50 hover:opacity-100 hover:text-destructive"
              onClick={handleDeleteBlock}
            >
              <Trash2Icon className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {renderBlockContent()}
    </div>
  );
};

export default BlockEditor;
