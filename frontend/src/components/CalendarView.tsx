import React, { useEffect, useState, useRef, useCallback } from 'react';

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  startHour: number;
  durationHours: number;
  category: 'CLASS' | 'MEETING' | 'DEADLINE' | 'PERSONAL';
}

export const CalendarView: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastSynced, setLastSynced] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Fetch events from FastAPI iCal endpoint
  const fetchCalendarEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/calendar/today');
      const data = await res.json();
      setEvents(data);
      setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Failed to sync Google Calendar events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendarEvents();

    // Auto-scroll to 8:00 AM on initial mount
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * 48;
    }

    // Background polling: Refresh schedule every 5 minutes (300,000 ms)
    const interval = setInterval(() => {
      fetchCalendarEvents();
    }, 300000);

    return () => clearInterval(interval);
  }, [fetchCalendarEvents]);

  const getEventStyle = (cat: CalendarEvent['category']) => {
    switch (cat) {
      case 'CLASS':
        return 'bg-emerald-50 text-emerald-900 border-l-4 border-l-emerald-500 border-emerald-200';
      case 'MEETING':
        return 'bg-sky-50 text-sky-900 border-l-4 border-l-sky-500 border-sky-200';
      case 'DEADLINE':
        return 'bg-amber-50 text-amber-900 border-l-4 border-l-amber-500 border-amber-200';
      default:
        return 'bg-purple-50 text-purple-900 border-l-4 border-l-purple-500 border-purple-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-xs">
            {new Date().getDate()}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">24-Hour Schedule Grid</h2>
            <p className="text-xs text-slate-500">
              Live Google Calendar iCal Feed {lastSynced && `• Synced at ${lastSynced}`}
            </p>
          </div>
        </div>

        {/* Sync / Refresh Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchCalendarEvents}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition disabled:opacity-50 cursor-pointer"
          >
            <span className={`text-sm ${loading ? 'animate-spin' : ''}`}>🔄</span>
            {loading ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Scrollable 24-Hour Grid */}
      <div ref={scrollRef} className="h-[600px] overflow-y-auto relative p-4">
        {hours.map((hour) => {
          const matchingEvent = events.find((e) => Math.floor(e.startHour) === hour);
          const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
          const ampm = hour >= 12 ? 'PM' : 'AM';

          return (
            <div key={hour} className="flex items-start gap-4 h-12 text-xs group">
              <span className="w-14 text-[11px] font-mono text-slate-400 text-right -mt-2 shrink-0">
                {displayHour}:00 {ampm}
              </span>
              <div className="flex-1 h-full border-t border-slate-100 relative">
                {matchingEvent && (
                  <div
                    className={`absolute inset-x-0 top-0 rounded-md p-2 border shadow-2xs flex items-center justify-between ${getEventStyle(
                      matchingEvent.category
                    )}`}
                    style={{ height: `${Math.max(matchingEvent.durationHours * 48, 40)}px`, zIndex: 10 }}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="font-semibold text-xs truncate">{matchingEvent.title}</span>
                      <span className="text-[10px] opacity-75 font-mono">
                        ({matchingEvent.startTime} – {matchingEvent.endTime})
                      </span>
                    </div>
                    <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/60 uppercase">
                      {matchingEvent.category}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};