import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useBlocksStore } from '@/stores/blocksStore';

interface Column {
  id: string;
  name: string;
  type: 'text' | 'number' | 'select' | 'date' | 'checkbox';
}

interface Row {
  id: string;
  cells: Record<string, any>;
}

interface TableBlockProps {
  id: string;
  pageId: string;
  content: {
    columns: Column[];
    has_header_row: boolean;
  };
  children: any[];
}

export const TableBlock: React.FC<TableBlockProps> = ({ id, pageId, content, children }) => {
  const { updateBlock, deleteBlock } = useBlocksStore();
  const { sendBlockUpdate } = useWebSocket();
  const [isEditing, setIsEditing] = useState(false);

  // Extract header row and data rows from children
  const headerRow = children.find(row => row.content?.is_header);
  const dataRows = children.filter(row => !row.content?.is_header);

  // Extract columns from content
  const { columns, has_header_row } = content;

  // Convert header cells and data cells to a more manageable format
  const headerCells = headerRow?.children || [];
  const rows = dataRows.map(row => {
    const cells: Record<string, any> = {};
    row.children?.forEach((cell: any) => {
      const columnId = cell.metadata?.column_id;
      if (columnId) {
        cells[columnId] = cell.content.text;
      }
    });
    return { id: row.id, cells };
  });

  // Handle adding a new column
  const handleAddColumn = () => {
    const newColumnId = `col-${Date.now()}`;
    const newColumn = {
      id: newColumnId,
      name: `Column ${columns.length + 1}`,
      type: 'text' as const
    };

    const updatedContent = {
      ...content,
      columns: [...columns, newColumn]
    };

    // Update local state
    updateBlock(id, updatedContent);

    // Send update to WebSocket
    sendBlockUpdate(pageId, id, updatedContent);
  };

  // Handle adding a new row
  const handleAddRow = () => {
    // This would need to call an API to create a new row block
    // For now, we'll just show how we would structure the API call
    console.log('Add row with cells for columns:', columns.map(col => col.id));
  };

  // Handle cell value change
  const handleCellChange = (rowId: string, columnId: string, value: string) => {
    // Find the block ID of the specific cell
    const row = dataRows.find(row => row.id === rowId);
    if (!row) return;

    const cell = row.children?.find((cell: any) => cell.metadata?.column_id === columnId);
    if (!cell) return;

    // Update cell content
    const updatedCellContent = { ...cell.content, text: value };

    // Update local state
    updateBlock(cell.id, updatedCellContent);

    // Send update to WebSocket
    sendBlockUpdate(pageId, cell.id, updatedCellContent);
  };

  return (
    <Card className="my-2 overflow-hidden border-2 border-muted">
      <div className="flex items-center justify-between p-2 bg-muted/20">
        <h3 className="text-sm font-medium">Table</h3>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddColumn}
            className="h-8 px-2 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" /> Add Column
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddRow}
            className="h-8 px-2 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" /> Add Row
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {has_header_row && (
              <thead>
                <tr className="bg-muted/30">
                  {columns.map(column => (
                    <th
                      key={column.id}
                      className="px-4 py-2 text-sm font-medium text-left border-b"
                    >
                      {column.name}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/10">
                  {columns.map(column => (
                    <td key={`${row.id}-${column.id}`} className="px-4 py-2">
                      <Input
                        value={row.cells[column.id] || ''}
                        onChange={(e) => handleCellChange(row.id, column.id, e.target.value)}
                        className="h-8 border-0 focus:ring-1 focus-visible:ring-1 focus:bg-muted/20"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default TableBlock;
