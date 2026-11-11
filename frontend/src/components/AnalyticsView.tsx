import React, { useRef, useEffect } from 'react';
import { AnalyticsBar, type AnalyticsBarRef } from './AnalyticsBar';
import { WeeklyFocusChart, type WeeklyFocusChartRef } from './WeeklyFocusChart';

export const AnalyticsView: React.FC = () => {
  const analyticsRef = useRef<AnalyticsBarRef>(null);
  const weeklyChartRef = useRef<WeeklyFocusChartRef>(null);

  useEffect(() => {
    // Refresh telemetry when switching into Analytics View
    if (analyticsRef.current) analyticsRef.current.refreshAnalytics();
    if (weeklyChartRef.current) weeklyChartRef.current.refreshWeeklyAnalytics();
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Focus & Telemetry Analytics</h2>
        <p className="text-xs text-gray-500">
          Track daily focus output and monitor 7-day productivity trends
        </p>
      </div>

      <AnalyticsBar ref={analyticsRef} />
      <WeeklyFocusChart ref={weeklyChartRef} />
    </div>
  );
};