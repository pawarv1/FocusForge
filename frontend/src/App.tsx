import React, { useState, useEffect } from 'react';
import { api } from './api/client';
import { Navbar, type NavTab } from './components/Navbar';
import { TaskListView } from './components/TaskListView';
import { RemindersView } from './components/RemindersView';
import { JournalView } from './components/JournalView';
import { AnalyticsView } from './components/AnalyticsView';
import type { Task, Priority, Category } from './types/task';

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

  const handleToggleComplete = async (id: number) => {
    try {
      const res = await api.patch<Task>(`/tasks/${id}/complete`);
      setTasks((prev) => prev.map((t) => (t.id === id ? res.data : t)));
    } catch (err) {
      console.error('Failed to toggle completion:', err);
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
    }
  };

  const getCategoryBadge = (c: Category) => {
    switch (c) {
      case 'RESEARCH':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'COURSEWORK':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'DEVELOPMENT':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'CAREER':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'OTHER':
        return 'bg-gray-100 text-gray-700 border-gray-200';
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