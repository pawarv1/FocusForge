import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';

export type CalendarCategory =
  | 'CLASS'
  | 'MEETING'
  | 'DEADLINE'
  | 'EXAM_INTERVIEW'
  | 'TASK_FOCUS'
  | 'EVENT'
  | 'GENERAL';

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  startHour: number;
  durationHours: number;
  category: CalendarCategory;
}

interface PositionedCalendarEvent extends CalendarEvent {
  colIndex: number;
  totalCols: number;
}

interface CalendarViewProps {
  onTaskCreated?: () => void;
}

const HOUR_HEIGHT_PX = 48;

const CATEGORY_STYLES: Record<CalendarCategory, { cardClasses: string; badgeClasses: string; label: string }> = {
  CLASS: {
    cardClasses: 'bg-emerald-50 text-emerald-950 border-l-4 border-l-emerald-500 border-emerald-200',
    badgeClasses: 'bg-emerald-100 text-emerald-800',
    label: 'Class',
  },
  MEETING: {
    cardClasses: 'bg-sky-50 text-sky-950 border-l-4 border-l-sky-500 border-sky-200',
    badgeClasses: 'bg-sky-100 text-sky-800',
    label: 'Meeting',
  },
  DEADLINE: {
    cardClasses: 'bg-amber-50 text-amber-950 border-l-4 border-l-amber-500 border-amber-200',
    badgeClasses: 'bg-amber-100 text-amber-800',
    label: 'Deadline',
  },
  EXAM_INTERVIEW: {
    cardClasses: 'bg-rose-50 text-rose-950 border-l-4 border-l-rose-600 border-rose-200',
    badgeClasses: 'bg-rose-100 text-rose-800',
    label: 'Exam / Interview',
  },
  TASK_FOCUS: {
    cardClasses: 'bg-indigo-50 text-indigo-950 border-l-4 border-l-indigo-500 border-indigo-200',
    badgeClasses: 'bg-indigo-100 text-indigo-800',
    label: 'Task Focus',
  },
  EVENT: {
    cardClasses: 'bg-purple-50 text-purple-950 border-l-4 border-l-purple-500 border-purple-200',
    badgeClasses: 'bg-purple-100 text-purple-800',
    label: 'Event',
  },
  GENERAL: {
    cardClasses: 'bg-slate-100 text-slate-900 border-l-4 border-l-slate-400 border-slate-200',
    badgeClasses: 'bg-slate-200/80 text-slate-700',
    label: 'General',
  },
};

const anyKeyword = (text: string, keywords: string[]): boolean =>
  keywords.some((kw) => text.includes(kw));

const mapCalendarToTaskCategory = (event: CalendarEvent): string => {
  const titleLower = event.title.toLowerCase();
  if (event.category === 'EXAM_INTERVIEW' && anyKeyword(titleLower, ['interview', 'oa', 'recruiter', 'career'])) {
    return 'CAREER';
  }
  if (anyKeyword(titleLower, ['csc', 'lecture', 'exam', 'midterm', 'final', 'hw', 'assignment', 'lab'])) {
    return 'COURSEWORK';
  }
  if (anyKeyword(titleLower, ['research', 'paper', 'poster', 'thesis'])) {
    return 'RESEARCH';
  }
  return 'DEVELOPMENT';
};

const buildDueDateISO = (event: CalendarEvent): string => {
  const due = new Date();
  const endDecimalHour = event.startHour + event.durationHours;
  const hours = Math.min(Math.floor(endDecimalHour), 23);
  const minutes = Math.round((endDecimalHour - Math.floor(endDecimalHour)) * 60);
  due.setHours(hours, minutes, 0, 0);
  return due.toISOString();
};

function layoutOverlappingEvents(events: CalendarEvent[]): PositionedCalendarEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => {
    if (a.startHour !== b.startHour) return a.startHour - b.startHour;
    return b.durationHours - a.durationHours;
  });

  const clusters: CalendarEvent[][] = [];
  let currentCluster: CalendarEvent[] = [];
  let clusterEnd = -1;

  for (const ev of sorted) {
    const evEnd = ev.startHour + Math.max(ev.durationHours, 0.5);
    if (currentCluster.length === 0 || ev.startHour < clusterEnd) {
      currentCluster.push(ev);
      clusterEnd = Math.max(clusterEnd, evEnd);
    } else {
      clusters.push(currentCluster);
      currentCluster = [ev];
      clusterEnd = evEnd;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const positioned: PositionedCalendarEvent[] = [];

  for (const cluster of clusters) {
    const columnEnds: number[] = [];
    const assignments: { event: CalendarEvent; colIndex: number }[] = [];

    for (const ev of cluster) {
      const evEnd = ev.startHour + Math.max(ev.durationHours, 0.5);
      let placedCol = columnEnds.findIndex((endTime) => endTime <= ev.startHour);

      if (placedCol === -1) {
        placedCol = columnEnds.length;
        columnEnds.push(evEnd);
      } else {
        columnEnds[placedCol] = evEnd;
      }

      assignments.push({ event: ev, colIndex: placedCol });
    }

    const totalCols = columnEnds.length;
    for (const { event, colIndex } of assignments) {
      positioned.push({
        ...event,
        colIndex,
        totalCols,
      });
    }
  }

  return positioned;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ onTaskCreated }) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastSynced, setLastSynced] = useState<string>('');
  const [now, setNow] = useState<Date>(() => new Date());
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promotedIds, setPromotedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const fetchCalendarEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/calendar/today');
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
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

    // Auto-scroll slightly above current time on mount
    if (scrollRef.current) {
      const currentHour = new Date().getHours();
      const targetHour = Math.max(currentHour - 2, 0);
      scrollRef.current.scrollTop = targetHour * HOUR_HEIGHT_PX;
    }

    // Refresh calendar feed every 5 minutes
    const syncInterval = setInterval(() => {
      fetchCalendarEvents();
    }, 300000);

    // Update live red current-time indicator every minute
    const clockInterval = setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => {
      clearInterval(syncInterval);
      clearInterval(clockInterval);
    };
  }, [fetchCalendarEvents]);

  const handlePromoteToTask = async (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    if (promotingId === event.id || promotedIds.has(event.id)) return;

    setPromotingId(event.id);
    try {
      const res = await fetch('http://localhost:8000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: event.title,
          description: `Promoted from Schedule (${event.startTime}${event.endTime ? ` – ${event.endTime}` : ''})`,
          category: mapCalendarToTaskCategory(event),
          priority: 'HIGH',
          due_date: buildDueDateISO(event),
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to create task: ${res.status}`);
      }

      setPromotedIds((prev) => new Set(prev).add(event.id));
      onTaskCreated?.();
    } catch (err) {
      console.error('Failed to promote calendar event to task:', err);
    } finally {
      setPromotingId(null);
    }
  };

  const positionedEvents = useMemo(() => layoutOverlappingEvents(events), [events]);

  const getCategoryMeta = (cat: CalendarCategory) => {
    return CATEGORY_STYLES[cat] ?? CATEGORY_STYLES.GENERAL;
  };

  const currentDecimalHour = now.getHours() + now.getMinutes() / 60;
  const currentTimeTopPx = currentDecimalHour * HOUR_HEIGHT_PX;
  const currentTimeLabel = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-xs">
            {now.getDate()}
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

      {/* Category Color Legend */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-white text-[11px]">
        {(Object.keys(CATEGORY_STYLES) as CalendarCategory[]).map((key) => {
          const meta = CATEGORY_STYLES[key];
          return (
            <span
              key={key}
              className={`px-2 py-0.5 rounded-full font-semibold ${meta.badgeClasses}`}
            >
              {meta.label}
            </span>
          );
        })}
      </div>

      {/* Scrollable 24-Hour Grid */}
      <div ref={scrollRef} className="h-[600px] overflow-y-auto relative p-4">
        <div className="relative flex" style={{ height: `${24 * HOUR_HEIGHT_PX}px` }}>
          {/* Left Time Axis */}
          <div className="w-16 shrink-0 pr-3 select-none relative">
            {hours.map((hour) => {
              const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
              const ampm = hour >= 12 ? 'PM' : 'AM';
              return (
                <div key={hour} className="h-12 text-right">
                  <span className="text-[11px] font-mono text-slate-400 -mt-2 inline-block">
                    {displayHour}:00 {ampm}
                  </span>
                </div>
              );
            })}

            {/* Live Red Current-Time Pill on Time Axis */}
            <div
              className="absolute right-2 -translate-y-1/2 pointer-events-none z-30"
              style={{ top: `${currentTimeTopPx}px` }}
            >
              <span className="bg-red-500 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap">
                {currentTimeLabel}
              </span>
            </div>
          </div>

          {/* Right Event Canvas (Grid Lines + Side-by-Side Events + Live Line) */}
          <div className="flex-1 relative">
            {/* Background Hour Dividers */}
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-12 border-t border-slate-100 pointer-events-none"
              />
            ))}

            {/* Positioned Event Cards */}
            {positionedEvents.map((event) => {
              const meta = getCategoryMeta(event.category);
              const topPx = event.startHour * HOUR_HEIGHT_PX;
              const heightPx = Math.max(event.durationHours * HOUR_HEIGHT_PX, 34);
              const widthPercent = 100 / event.totalCols;
              const leftPercent = event.colIndex * widthPercent;

              const isPromotable =
                event.category === 'DEADLINE' || event.category === 'EXAM_INTERVIEW';
              const isPromoted = promotedIds.has(event.id);
              const isPromoting = promotingId === event.id;

              return (
                <div
                  key={event.id}
                  title={`${event.title} (${event.startTime}${event.endTime ? ` – ${event.endTime}` : ''})`}
                  className={`absolute rounded-md px-2.5 py-1.5 border shadow-2xs flex items-start justify-between gap-1.5 overflow-hidden transition-all ${meta.cardClasses}`}
                  style={{
                    top: `${topPx}px`,
                    height: `${heightPx}px`,
                    left: `calc(${leftPercent}% + 2px)`,
                    width: `calc(${widthPercent}% - 4px)`,
                    zIndex: 10 + event.colIndex,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs truncate leading-tight">
                      {event.title}
                    </div>
                    <div className="text-[10px] opacity-75 font-mono truncate mt-0.5">
                      {event.endTime ? `${event.startTime} – ${event.endTime}` : event.startTime}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isPromotable && (
                      <button
                        type="button"
                        onClick={(e) => handlePromoteToTask(e, event)}
                        disabled={isPromoting || isPromoted}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${
                          isPromoted
                            ? 'bg-emerald-600 text-white border-emerald-600 cursor-default'
                            : 'bg-white/90 hover:bg-white text-slate-800 border-slate-300/80 shadow-2xs'
                        }`}
                      >
                        {isPromoting ? '...' : isPromoted ? '✓ Added' : '+ Task'}
                      </button>
                    )}

                    {event.totalCols <= 2 && (
                      <span
                        className={`text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded ${meta.badgeClasses}`}
                      >
                        {meta.label}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Live Red Current-Time Horizontal Line + Anchor Dot */}
            <div
              className="absolute inset-x-0 -translate-y-1/2 pointer-events-none z-30 flex items-center"
              style={{ top: `${currentTimeTopPx}px` }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shadow-xs ring-2 ring-white shrink-0" />
              <div className="flex-1 h-[2px] bg-red-500 shadow-2xs" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;