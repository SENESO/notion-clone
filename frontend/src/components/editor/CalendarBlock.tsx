import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, ChevronLeft, ChevronRight, MoreHorizontal, X } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useBlocksStore } from '@/stores/blocksStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

interface CalendarEvent {
  id: string;
  content: {
    title: string;
    description?: string;
    start_date: string;
    end_date?: string;
    all_day?: boolean;
    color?: string;
    location?: string;
    attendees?: string[];
  };
}

interface CalendarBlockProps {
  id: string;
  pageId: string;
  content: {
    name: string;
    date_property: string;
    start_date: string;
    time_format?: '12h' | '24h';
  };
  children: CalendarEvent[];
  view_type?: 'month' | 'week' | 'day';
}

export const CalendarBlock: React.FC<CalendarBlockProps> = ({
  id,
  pageId,
  content,
  children,
  view_type = 'month'
}) => {
  const { updateBlock } = useBlocksStore();
  const { sendBlockUpdate } = useWebSocket();

  const [currentDate, setCurrentDate] = useState(new Date(content.start_date || new Date()));
  const [viewType, setViewType] = useState<'month' | 'week' | 'day'>(view_type);
  const [showingEventId, setShowingEventId] = useState<string | null>(null);
  const [addingEvent, setAddingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent['content']>>({
    title: '',
    start_date: new Date().toISOString().split('T')[0],
    all_day: true
  });

  // Events from children
  const events = children || [];

  // Get calendar navigation dates
  const calendarDates = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Get first day of the month
    const firstDay = new Date(year, month, 1);
    // Get last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Get day of week for the first day (0 = Sunday, 6 = Saturday)
    const firstDayOfWeek = firstDay.getDay();

    // Create array of days for the month view
    const days = [];

    // Add days from previous month to fill the first week
    const daysFromPrevMonth = firstDayOfWeek;
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    for (let i = prevMonthLastDay - daysFromPrevMonth + 1; i <= prevMonthLastDay; i++) {
      days.push({
        date: new Date(year, month - 1, i),
        isCurrentMonth: false
      });
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    // Add days from next month to complete the grid
    const remainingDays = 42 - days.length; // 6 rows of 7 days

    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    return days;
  }, [currentDate]);

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();

  // Handle navigation between months
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Check if a date has events
  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const startDate = new Date(event.content.start_date);
      startDate.setHours(0, 0, 0, 0);

      const endDate = event.content.end_date
        ? new Date(event.content.end_date)
        : new Date(event.content.start_date);
      endDate.setHours(23, 59, 59, 999);

      const checkDate = new Date(date);
      checkDate.setHours(12, 0, 0, 0);

      return checkDate >= startDate && checkDate <= endDate;
    });
  };

  // Get the currently viewed event
  const currentEvent = useMemo(() => {
    if (!showingEventId) return null;
    return events.find(event => event.id === showingEventId) || null;
  }, [showingEventId, events]);

  // Handle saving new event
  const handleSaveEvent = () => {
    if (!newEvent.title?.trim() || !newEvent.start_date) return;

    // In a real app, this would call an API to create a new event block
    console.log('Create new event:', newEvent);

    // Reset form
    setAddingEvent(false);
    setNewEvent({
      title: '',
      start_date: new Date().toISOString().split('T')[0],
      all_day: true
    });
  };

  // Helper to get color class for events
  const getEventColorClass = (color?: string) => {
    if (!color) return 'bg-blue-500';

    switch (color) {
      case 'red': return 'bg-red-500';
      case 'orange': return 'bg-orange-500';
      case 'yellow': return 'bg-yellow-500';
      case 'green': return 'bg-green-500';
      case 'blue': return 'bg-blue-500';
      case 'purple': return 'bg-purple-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="my-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">{content.name || 'Calendar'}</h3>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setAddingEvent(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Event
          </Button>
          <div className="flex">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center px-2">
              <span className="text-sm font-medium">
                {monthName} {year}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Calendar header - days of week */}
          <div className="grid grid-cols-7 border-b">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
              <div key={day} className="py-2 text-center text-sm font-medium">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calendarDates.map(({ date, isCurrentMonth }, index) => {
              const dateEvents = getEventsForDate(date);
              const isToday = date.toDateString() === new Date().toDateString();

              return (
                <div
                  key={date.toISOString()}
                  className={`
                    min-h-[100px] p-1 border-b border-r
                    ${isCurrentMonth ? 'bg-background' : 'bg-muted/20 text-muted-foreground'}
                    ${isToday ? 'ring-2 ring-inset ring-primary' : ''}
                  `}
                >
                  <div className="flex flex-col h-full">
                    <div className="text-xs p-1">{date.getDate()}</div>

                    <div className="flex-1 overflow-y-auto space-y-1">
                      {dateEvents.map(event => (
                        <div
                          key={event.id}
                          className={`
                            px-2 py-1 text-xs rounded text-white cursor-pointer
                            ${getEventColorClass(event.content.color)}
                          `}
                          onClick={() => setShowingEventId(event.id)}
                        >
                          {event.content.title}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Event details dialog */}
      <Dialog open={!!currentEvent} onOpenChange={(open) => !open && setShowingEventId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentEvent?.content.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {currentEvent?.content.description && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Description</h4>
                <p className="text-sm">{currentEvent.content.description}</p>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Date & Time</h4>
              <p className="text-sm">
                {new Date(currentEvent?.content.start_date || '').toLocaleDateString()}
                {currentEvent?.content.end_date && (
                  <> &ndash; {new Date(currentEvent.content.end_date).toLocaleDateString()}</>
                )}
                {currentEvent?.content.all_day && <span className="ml-2">(All day)</span>}
              </p>
            </div>

            {currentEvent?.content.location && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Location</h4>
                <p className="text-sm">{currentEvent.content.location}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowingEventId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add event dialog */}
      <Dialog open={addingEvent} onOpenChange={setAddingEvent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Event</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={newEvent.title || ''}
                onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                placeholder="Event title"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={newEvent.description || ''}
                onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                placeholder="Event description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={newEvent.start_date || ''}
                  onChange={(e) => setNewEvent({...newEvent, start_date: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={newEvent.end_date || ''}
                  onChange={(e) => setNewEvent({...newEvent, end_date: e.target.value})}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="all-day"
                checked={newEvent.all_day}
                onCheckedChange={(checked) =>
                  setNewEvent({...newEvent, all_day: !!checked})
                }
              />
              <label htmlFor="all-day" className="text-sm font-medium">
                All day event
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <Input
                value={newEvent.location || ''}
                onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                placeholder="Event location"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingEvent(false)}>Cancel</Button>
            <Button
              onClick={handleSaveEvent}
              disabled={!newEvent.title?.trim() || !newEvent.start_date}
            >
              Create Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarBlock;
