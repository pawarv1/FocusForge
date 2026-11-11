import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { api } from '../api/client';

export interface AnalyticsBarRef {
  refreshAnalytics: () => void;
}

interface AnalyticsData {
  total_focus_minutes: number;
  completed_work_sessions: number;
  completed_break_sessions: number;
}

export const AnalyticsBar = forwardRef<AnalyticsBarRef>((_, ref) => {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    total_focus_minutes: 0,
    completed_work_sessions: 0,
    completed_break_sessions: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      const response = await api.get<AnalyticsData>('/sessions/analytics/today');
      setAnalytics(response.data);
    } catch (err) {
      console.error('Failed to fetch today analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  useImperativeHandle(ref, () => ({
    refreshAnalytics: fetchAnalytics,
  }));

  const formatFocusTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  };

  return (
    <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-center shadow-sm">
      {/* Total Focus Time */}
      <div className="space-y-1 border-r border-slate-200 pr-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Focus Time Today
        </span>
        <div className="text-xl font-extrabold text-slate-900">
          {isLoading ? '...' : formatFocusTime(analytics.total_focus_minutes)}
        </div>
      </div>

      {/* Work Blocks */}
      <div className="space-y-1 border-r border-slate-200 px-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Work Sessions
        </span>
        <div className="text-xl font-extrabold text-amber-600">
          {isLoading ? '...' : `${analytics.completed_work_sessions} ⏱️`}
        </div>
      </div>

      {/* Rest Breaks */}
      <div className="space-y-1 pl-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Rest Breaks
        </span>
        <div className="text-xl font-extrabold text-emerald-600">
          {isLoading ? '...' : `${analytics.completed_break_sessions} ☕`}
        </div>
      </div>
    </div>
  );
});