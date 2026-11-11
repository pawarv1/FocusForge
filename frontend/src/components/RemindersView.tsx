import React from 'react';
import type { Task, Priority, Category } from '../types/task';

interface RemindersViewProps {
  tasks: Task[];
  onToggleComplete: (id: number) => void;
  getCategoryBadge: (c: Category) => string;
  getPriorityBadge: (p: Priority) => string;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  tasks,
  onToggleComplete,
  getCategoryBadge,
  getPriorityBadge,
}) => {
  const scheduledTasks = tasks
    .filter((t) => !t.is_completed && t.due_date)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());

  const isDueSoon = (dateStr: string): boolean => {
    const due = new Date(dateStr).getTime();
    const now = new Date().getTime();
    const hoursRemaining = (due - now) / (1000 * 60 * 60);
    return hoursRemaining > 0 && hoursRemaining <= 24;
  };

  const isOverdue = (dateStr: string): boolean => {
    return new Date(dateStr).getTime() < new Date().getTime();
  };

  const formatDeadline = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Hard Deadlines & Reminders</h2>
          <p className="text-xs text-gray-500">
            Time-sensitive milestones, submission cutoffs, and scheduled deliverables
          </p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 bg-slate-900 text-white rounded-full">
          {scheduledTasks.length} Scheduled
        </span>
      </div>

      {scheduledTasks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 border border-dashed rounded-xl text-gray-400 text-sm">
          No upcoming deadlines scheduled. Add a due date to tasks in your workspace to track hard deadlines here!
        </div>
      ) : (
        <div className="space-y-3">
          {scheduledTasks.map((task) => {
            const dueStr = task.due_date!;
            const urgent = isDueSoon(dueStr);
            const overdue = isOverdue(dueStr);

            return (
              <div
                key={task.id}
                className={`p-4 rounded-xl border transition shadow-sm space-y-2 ${
                  overdue
                    ? 'bg-red-50/80 border-red-300'
                    : urgent
                    ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-400/20'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={task.is_completed}
                      onChange={() => onToggleComplete(task.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="font-bold text-sm text-slate-900">
                      {task.title}
                    </span>
                  </div>

                  {/* Urgency Badge */}
                  {overdue ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-300 animate-pulse">
                      🚨 Overdue
                    </span>
                  ) : urgent ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300">
                      ⚡ Due within 24h
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      📅 Scheduled
                    </span>
                  )}
                </div>

                {task.description && (
                  <p className="text-xs text-slate-600 pl-6">
                    {task.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs pt-1 pl-6">
                  <div className="flex gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getCategoryBadge(
                        task.category
                      )}`}
                    >
                      {task.category}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPriorityBadge(
                        task.priority
                      )}`}
                    >
                      {task.priority}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-xs ${
                      overdue
                        ? 'text-red-700 font-bold'
                        : urgent
                        ? 'text-amber-800 font-semibold'
                        : 'text-slate-500'
                    }`}
                  >
                    Target: {formatDeadline(dueStr)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};