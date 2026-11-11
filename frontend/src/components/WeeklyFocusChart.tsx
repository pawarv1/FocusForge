import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { api } from '../api/client';

export interface WeeklyFocusChartRef {
  refreshWeeklyAnalytics: () => void;
}

interface DailyFocusItem {
  date: string;
  day_label: string;
  focus_minutes: number;
  session_count: number;
}

interface WeeklyAnalyticsResponse {
  daily_history: DailyFocusItem[];
  total_weekly_minutes: number;
}

export const WeeklyFocusChart = forwardRef<WeeklyFocusChartRef>((_, ref) => {
  const [weeklyData, setWeeklyData] = useState<WeeklyAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeeklyAnalytics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get<WeeklyAnalyticsResponse>('/sessions/analytics/weekly');
      setWeeklyData(response.data);
    } catch (err) {
      console.error('Failed to fetch weekly focus analytics:', err);
      setError('Could not load weekly analytics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeeklyAnalytics();
  }, []);

  useImperativeHandle(ref, () => ({
    refreshWeeklyAnalytics: fetchWeeklyAnalytics,
  }));

  if (isLoading) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400 text-sm">
        Loading weekly focus analytics...
      </div>
    );
  }

  if (error || !weeklyData) {
    return (
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400 text-xs">
        {error || 'No weekly analytics available.'}
      </div>
    );
  }

  const maxMinutes = Math.max(...weeklyData.daily_history.map((d) => d.focus_minutes), 60);

  const formatTotalTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hrs = (minutes / 60).toFixed(1);
    return `${hrs} hrs`;
  };

  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-white space-y-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Past 7 Days Output
          </h3>
          <p className="text-xl font-bold text-white">
            {formatTotalTime(weeklyData.total_weekly_minutes)} Total Focus
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">
          📊 7-Day Trend
        </span>
      </div>

      <div className="flex items-end justify-between gap-2 h-40 pt-6 pb-2 px-2 border-b border-slate-800">
        {weeklyData.daily_history.map((item) => {
          const heightPercent = Math.max(
            Math.round((item.focus_minutes / maxMinutes) * 100),
            item.focus_minutes > 0 ? 8 : 4
          );
          const isToday = new Date().toISOString().slice(0, 10) === item.date;

          return (
            <div key={item.date} className="flex-1 flex flex-col items-center gap-2 group relative">
              <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md pointer-events-none whitespace-nowrap z-10 border border-slate-700">
                {item.focus_minutes}m ({item.session_count} {item.session_count === 1 ? 'session' : 'sessions'})
              </div>

              <span className="text-[10px] font-mono font-medium text-slate-400">
                {item.focus_minutes > 0 ? `${item.focus_minutes}m` : ''}
              </span>

              <div className="w-full max-w-[28px] bg-slate-800 rounded-t-md overflow-hidden flex items-end h-full">
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t-md transition-all duration-500 ${
                    isToday
                      ? 'bg-amber-400 group-hover:bg-amber-300'
                      : item.focus_minutes > 0
                      ? 'bg-blue-600 group-hover:bg-blue-500'
                      : 'bg-slate-700/50'
                  }`}
                />
              </div>

              <span
                className={`text-xs font-bold ${
                  isToday ? 'text-amber-400' : 'text-slate-400'
                }`}
              >
                {item.day_label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});