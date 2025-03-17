import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  SearchIcon, FilterIcon, ArrowUpDown, Table,
  List, Kanban, Calendar, ChevronDown, Trash2, X
} from 'lucide-react';
import TableBlock from './TableBlock';
import KanbanBlock from './KanbanBlock';
import CalendarBlock from './CalendarBlock';

export type ColumnType = 'text' | 'number' | 'select' | 'date' | 'checkbox' | 'person' | 'file';

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  options?: { id: string; name: string; color?: string }[];
}

export type ViewType = 'table' | 'list' | 'board' | 'calendar' | 'gallery';

export interface View {
  id: string;
  name: string;
  type: ViewType;
  filters?: Filter[];
  sorts?: Sort[];
  groupBy?: string;
  hidden_columns?: string[];
}

export interface Filter {
  id: string;
  column: string;
  operator: string;
  value: any;
}

export interface Sort {
  column: string;
  direction: 'asc' | 'desc';
}

export interface Row {
  id: string;
  cells: Record<string, any>;
}

interface DatabaseViewProps {
  id: string;
  pageId: string;
  content: {
    name: string;
    columns: Column[];
    views?: View[];
  };
  children: any[];
  view_type?: ViewType;
  onViewChange?: (view: ViewType) => void;
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({
  id,
  pageId,
  content,
  children,
  view_type = 'table',
  onViewChange
}) => {
  const [currentView, setCurrentView] = useState<ViewType>(view_type);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sorts, setSorts] = useState<Sort[]>([]);

  // Extract data from children based on block types
  const rows = useMemo(() => {
    const result: Row[] = [];

    // Handle table blocks
    if (currentView === 'table') {
      const tableRows = children.filter(child => child.type === 'table_row' && !child.content?.is_header);

      tableRows.forEach(row => {
        const cells: Record<string, any> = {};

        // Extract cells for each column
        row.children?.forEach((cell: any) => {
          const columnId = cell.metadata?.column_id;
          if (columnId) {
            cells[columnId] = cell.content.text;
          }
        });

        result.push({ id: row.id, cells });
      });
    }
    // For other view types, the extraction would be different

    return result;
  }, [children, currentView]);

  // Apply filters
  const filteredRows = useMemo(() => {
    if (!filters.length && !searchQuery) return rows;

    return rows.filter(row => {
      // Apply search query across all cells
      if (searchQuery) {
        const rowValues = Object.values(row.cells);
        const matchesSearch = rowValues.some(value =>
          String(value).toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (!matchesSearch) return false;
      }

      // Apply filters
      for (const filter of filters) {
        const cellValue = row.cells[filter.column];
        const column = content.columns.find(col => col.id === filter.column);

        if (!cellValue) {
          // If cell doesn't have a value for this column
          return false;
        }

        switch (filter.operator) {
          case 'contains':
            if (!String(cellValue).toLowerCase().includes(String(filter.value).toLowerCase())) {
              return false;
            }
            break;
          case 'equals':
            if (String(cellValue) !== String(filter.value)) {
              return false;
            }
            break;
          case 'not_equals':
            if (String(cellValue) === String(filter.value)) {
              return false;
            }
            break;
          case 'greater':
            if (column?.type === 'number' && Number(cellValue) <= Number(filter.value)) {
              return false;
            }
            break;
          case 'less':
            if (column?.type === 'number' && Number(cellValue) >= Number(filter.value)) {
              return false;
            }
            break;
          case 'is_empty':
            if (cellValue !== '' && cellValue != null) {
              return false;
            }
            break;
          case 'is_not_empty':
            if (cellValue === '' || cellValue == null) {
              return false;
            }
            break;
        }
      }

      return true;
    });
  }, [rows, filters, searchQuery, content.columns]);

  // Apply sorts
  const sortedRows = useMemo(() => {
    if (!sorts.length) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      for (const sort of sorts) {
        const column = content.columns.find(col => col.id === sort.column);
        const valueA = a.cells[sort.column];
        const valueB = b.cells[sort.column];

        if (valueA == null && valueB == null) continue;
        if (valueA == null) return sort.direction === 'asc' ? -1 : 1;
        if (valueB == null) return sort.direction === 'asc' ? 1 : -1;

        if (column?.type === 'number') {
          const numA = Number(valueA);
          const numB = Number(valueB);

          if (numA !== numB) {
            return sort.direction === 'asc' ? numA - numB : numB - numA;
          }
        } else {
          const strA = String(valueA).toLowerCase();
          const strB = String(valueB).toLowerCase();

          if (strA !== strB) {
            const comparison = strA.localeCompare(strB);
            return sort.direction === 'asc' ? comparison : -comparison;
          }
        }
      }

      return 0;
    });
  }, [filteredRows, sorts, content.columns]);

  // Add a new filter
  const addFilter = () => {
    if (!content.columns.length) return;

    const firstColumn = content.columns[0];
    const newFilter: Filter = {
      id: `filter-${Date.now()}`,
      column: firstColumn.id,
      operator: 'contains',
      value: ''
    };

    setFilters([...filters, newFilter]);
  };

  // Update a filter
  const updateFilter = (id: string, updates: Partial<Filter>) => {
    setFilters(prev => prev.map(filter =>
      filter.id === id ? { ...filter, ...updates } : filter
    ));
  };

  // Remove a filter
  const removeFilter = (id: string) => {
    setFilters(prev => prev.filter(filter => filter.id !== id));
  };

  // Add a sort
  const addSort = () => {
    if (!content.columns.length) return;

    const firstColumn = content.columns[0];
    const newSort: Sort = {
      column: firstColumn.id,
      direction: 'asc'
    };

    setSorts([...sorts, newSort]);
  };

  // Update a sort
  const updateSort = (index: number, updates: Partial<Sort>) => {
    setSorts(prev => prev.map((sort, i) =>
      i === index ? { ...sort, ...updates } : sort
    ));
  };

  // Remove a sort
  const removeSort = (index: number) => {
    setSorts(prev => prev.filter((_, i) => i !== index));
  };

  // Change view type
  const handleViewTypeChange = (type: ViewType) => {
    setCurrentView(type);
    if (onViewChange) {
      onViewChange(type);
    }
  };

  // Render view based on type
  const renderView = () => {
    switch (currentView) {
      case 'table':
        return (
          <TableBlock
            id={id}
            pageId={pageId}
            content={{
              columns: content.columns,
              has_header_row: true
            }}
            children={children}
          />
        );
      case 'board':
        return (
          <KanbanBlock
            id={id}
            pageId={pageId}
            content={{
              name: content.name,
              item_property: 'title'
            }}
            children={children}
          />
        );
      case 'calendar':
        return (
          <CalendarBlock
            id={id}
            pageId={pageId}
            content={{
              name: content.name,
              date_property: 'date',
              start_date: new Date().toISOString().split('T')[0],
            }}
            children={children}
          />
        );
      default:
        return <div>Unsupported view type: {currentView}</div>;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-semibold">
              {content.name || 'Database'}
            </CardTitle>

            <div className="flex items-center space-x-2">
              {/* View Switcher */}
              <Tabs value={currentView} onValueChange={(val) => handleViewTypeChange(val as ViewType)}>
                <TabsList>
                  <TabsTrigger value="table">
                    <Table className="h-4 w-4 mr-1" />
                    Table
                  </TabsTrigger>
                  <TabsTrigger value="list">
                    <List className="h-4 w-4 mr-1" />
                    List
                  </TabsTrigger>
                  <TabsTrigger value="board">
                    <Kanban className="h-4 w-4 mr-1" />
                    Board
                  </TabsTrigger>
                  <TabsTrigger value="calendar">
                    <Calendar className="h-4 w-4 mr-1" />
                    Calendar
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Search, Filter, Sort controls */}
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <FilterIcon className="h-4 w-4 mr-1" />
                  Filter
                  {filters.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{filters.length}</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72">
                <div className="p-2">
                  <h4 className="font-medium mb-2">Filters</h4>

                  {filters.length === 0 ? (
                    <p className="text-sm text-muted-foreground mb-2">No filters applied</p>
                  ) : (
                    <div className="space-y-2 mb-2">
                      {filters.map(filter => (
                        <div key={filter.id} className="flex items-center space-x-1">
                          <Select
                            value={filter.column}
                            onValueChange={(value) => updateFilter(filter.id, { column: value })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {content.columns.map(column => (
                                <SelectItem key={column.id} value={column.id}>
                                  {column.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={filter.operator}
                            onValueChange={(value) => updateFilter(filter.id, { operator: value })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="contains">contains</SelectItem>
                              <SelectItem value="equals">equals</SelectItem>
                              <SelectItem value="not_equals">does not equal</SelectItem>
                              <SelectItem value="greater">greater than</SelectItem>
                              <SelectItem value="less">less than</SelectItem>
                              <SelectItem value="is_empty">is empty</SelectItem>
                              <SelectItem value="is_not_empty">is not empty</SelectItem>
                            </SelectContent>
                          </Select>

                          {!['is_empty', 'is_not_empty'].includes(filter.operator) && (
                            <Input
                              value={filter.value || ''}
                              onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                              className="h-8 text-xs"
                              placeholder="Value"
                            />
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeFilter(filter.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={addFilter}
                  >
                    Add Filter
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowUpDown className="h-4 w-4 mr-1" />
                  Sort
                  {sorts.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{sorts.length}</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72">
                <div className="p-2">
                  <h4 className="font-medium mb-2">Sort by</h4>

                  {sorts.length === 0 ? (
                    <p className="text-sm text-muted-foreground mb-2">No sorts applied</p>
                  ) : (
                    <div className="space-y-2 mb-2">
                      {sorts.map((sort, index) => (
                        <div key={index} className="flex items-center space-x-1">
                          <Select
                            value={sort.column}
                            onValueChange={(value) => updateSort(index, { column: value })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {content.columns.map(column => (
                                <SelectItem key={column.id} value={column.id}>
                                  {column.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={sort.direction}
                            onValueChange={(value: 'asc' | 'desc') => updateSort(index, { direction: value })}
                          >
                            <SelectTrigger className="h-8 text-xs w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="asc">Ascending</SelectItem>
                              <SelectItem value="desc">Descending</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeSort(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={addSort}
                  >
                    Add Sort
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* View Content */}
          {renderView()}
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseView;
