import React, { useState, useEffect } from 'react';
import { api } from './api/client';
import { Navbar, type NavTab } from './components/Navbar';
import { TaskListView } from './components/TaskListView';
import { RemindersView } from './components/RemindersView';
import { JournalView } from './components/JournalView';
import { AnalyticsView } from './components/AnalyticsView';
import type { Task, Priority } from './types/task';

const DYNAMIC_BADGE_PALETTE = [
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
];

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);

  const fetchTasks = async () => {
    try {
      const res = await api.get<Task[]>('/tasks');
      setTasks(res.data);
    } catch (err) {
      console.error('Failed to sync tasks:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [activeTab]);

  const handleToggleComplete = async (googleTaskId: string, googleListId: string) => {
    try {
      await api.patch(`/tasks/${googleTaskId}/complete`, null, {
        params: { google_list_id: googleListId },
      });
      setTasks((prev) => prev.filter((t) => t.google_task_id !== googleTaskId));
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
  };

  const getPriorityBadge = (p: Priority) => {
    switch (p) {
      case 'HIGH':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'LOW':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'UNASSIGNED':
      default:
        return 'bg-amber-50 text-amber-700 border-dashed border-amber-300';
    }
  };

  const getCategoryBadge = (categoryName: string) => {
    const normalized = categoryName.trim().toUpperCase();
    switch (normalized) {
      case 'RESEARCH':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'COURSEWORK':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'DEVELOPMENT':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'CAREER':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default: {
        let hash = 0;
        for (let i = 0; i < normalized.length; i++) {
          hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
        }
        return DYNAMIC_BADGE_PALETTE[Math.abs(hash) % DYNAMIC_BADGE_PALETTE.length];
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        appName="FocusForge"
      />

      {/* Main Container */}
      <main className="max-w-4xl mx-auto p-6">
        {activeTab === 'tasks' && <TaskListView />}
        {activeTab === 'reminders' && (
          <RemindersView
            tasks={tasks}
            onToggleComplete={handleToggleComplete}
            getCategoryBadge={getCategoryBadge}
            getPriorityBadge={getPriorityBadge}
          />
        )}
        {activeTab === 'journal' && <JournalView />}
        {activeTab === 'analytics' && <AnalyticsView />}
      </main>
    </div>
  );
};

export default App;