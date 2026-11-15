import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../api/client';
import { PomodoroTimer, type PomodoroTimerRef } from './PomodoroTimer';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import type { Task, Priority, MicroStep } from '../types/task';

const DYNAMIC_BADGE_PALETTE = [
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
];

export const TaskListView: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Focus tracking state
  const [activeFocusTaskId, setActiveFocusTaskId] = useState<string | null>(null);

  // Category filter state (derived from Google Task Lists)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Refs
  const timerRef = useRef<PomodoroTimerRef>(null);

  // Execution metadata editing state (Priority & Est. Minutes)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editPriority, setEditPriority] = useState<Priority>('UNASSIGNED');
  const [editEstimatedMinutes, setEditEstimatedMinutes] = useState<string>('');

  // Micro-step input state per task
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [newStepTitle, setNewStepTitle] = useState<string>('');

  useKeyboardShortcuts({
    onToggleTimer: () => {
      if (timerRef.current) {
        timerRef.current.toggleTimer();
      }
    },
    onSubmitForm: () => {
      const submitBtn = document.querySelector<HTMLButtonElement>('form button[type="submit"]');
      if (submitBtn) submitBtn.click();
    },
    onEscape: () => {
      setEditingTaskId(null);
      setExpandedTaskId(null);
    },
  });

  const fetchTasks = async (showSpinner = true) => {
    try {
      if (showSpinner) setIsLoading(true);
      else setIsSyncing(true);
      setError(null);
      const response = await api.get<Task[]>('/tasks');
      setTasks(response.data);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Could not load tasks. Is the backend server running?');
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchTasks(true);
  }, []);

  const activeFocusTask = tasks.find((t) => t.google_task_id === activeFocusTaskId) || null;

  // Dynamic categories sourced from Google Task Lists
  const availableCategories = useMemo(() => {
    const unique = Array.from(new Set(tasks.map((t) => t.category).filter(Boolean)));
    return ['ALL', ...unique];
  }, [tasks]);

  // 1. Toggle Top 3 Status
  const handleToggleTop3 = async (task: Task) => {
    const currentTop3Count = tasks.filter((t) => t.is_top3).length;

    if (!task.is_top3 && currentTop3Count >= 3) {
      setError('You can only select up to 3 focus tasks for Today!');
      return;
    }

    try {
      setError(null);
      const response = await api.patch<{
        google_task_id: string;
        priority: Priority;
        previous_priority: Priority | null;
        is_top3: boolean;
      }>(`/tasks/${task.google_task_id}/top3`, null, {
        params: { google_list_id: task.google_list_id },
      });

      setTasks((prev) =>
        prev.map((t) =>
          t.google_task_id === task.google_task_id
            ? {
                ...t,
                priority: response.data.priority,
                previous_priority: response.data.previous_priority,
                is_top3: response.data.is_top3,
              }
            : t
        )
      );

      if (task.is_top3 && activeFocusTaskId === task.google_task_id) {
        setActiveFocusTaskId(null);
      }
    } catch (err: any) {
      console.error('Error toggling Top 3 status:', err);
      const msg = err.response?.data?.detail || 'Failed to update priority status.';
      setError(msg);
    }
  };

  // 2. Complete Task in Google Tasks
  const handleToggleComplete = async (googleTaskId: string) => {
    const target = tasks.find((t) => t.google_task_id === googleTaskId);
    try {
      setError(null);
      await api.patch(`/tasks/${googleTaskId}/complete`, null, {
        params: { google_list_id: target?.google_list_id || '@default' },
      });
      setTasks((prev) => prev.filter((t) => t.google_task_id !== googleTaskId));

      if (activeFocusTaskId === googleTaskId) {
        setActiveFocusTaskId(null);
      }
    } catch (err) {
      console.error('Error completing task:', err);
      setError('Failed to mark task complete.');
    }
  };

  // 3. Edit Execution Metadata (Priority & Estimated Minutes)
  const startEditing = (task: Task) => {
    setEditingTaskId(task.google_task_id);
    setEditPriority(task.priority);
    setEditEstimatedMinutes(task.estimated_minutes ? String(task.estimated_minutes) : '');
  };

  const handleSaveEdit = async (task: Task) => {
    try {
      setError(null);
      const parsedMinutes = editEstimatedMinutes.trim()
        ? parseInt(editEstimatedMinutes, 10)
        : null;

      await api.patch(`/tasks/${task.google_task_id}`, {
        google_list_id: task.google_list_id,
        priority: editPriority,
        estimated_minutes: parsedMinutes && parsedMinutes > 0 ? parsedMinutes : null,
      });

      setTasks((prev) =>
        prev.map((t) =>
          t.google_task_id === task.google_task_id
            ? {
                ...t,
                priority: editPriority,
                estimated_minutes: parsedMinutes && parsedMinutes > 0 ? parsedMinutes : null,
              }
            : t
        )
      );
      setEditingTaskId(null);
    } catch (err: any) {
      console.error('Error updating task metadata:', err);
      const msg = err.response?.data?.detail || 'Failed to update task.';
      setError(msg);
    }
  };

  // 4. Micro-Step Breakdown Handlers
  const handleAddStep = async (task: Task, e: React.FormEvent) => {
    e.preventDefault();
    if (!newStepTitle.trim()) return;

    try {
      setError(null);
      const res = await api.post<MicroStep>(
        `/tasks/${task.google_task_id}/steps`,
        {
          title: newStepTitle.trim(),
          position: task.steps.length,
        },
        { params: { google_list_id: task.google_list_id } }
      );

      setTasks((prev) =>
        prev.map((t) =>
          t.google_task_id === task.google_task_id
            ? { ...t, steps: [...t.steps, res.data] }
            : t
        )
      );
      setNewStepTitle('');
    } catch (err) {
      console.error('Error adding micro-step:', err);
      setError('Failed to add step.');
    }
  };

  const handleToggleStep = async (googleTaskId: string, step: MicroStep) => {
    try {
      const res = await api.patch<MicroStep>(`/steps/${step.id}`, {
        is_done: !step.is_done,
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.google_task_id === googleTaskId
            ? {
                ...t,
                steps: t.steps.map((s) => (s.id === step.id ? res.data : s)),
              }
            : t
        )
      );
    } catch (err) {
      console.error('Error toggling step:', err);
    }
  };

  const handleDeleteStep = async (googleTaskId: string, stepId: number) => {
    try {
      await api.delete(`/steps/${stepId}`);
      setTasks((prev) =>
        prev.map((t) =>
          t.google_task_id === googleTaskId
            ? { ...t, steps: t.steps.filter((s) => s.id !== stepId) }
            : t
        )
      );
    } catch (err) {
      console.error('Error deleting step:', err);
    }
  };

  const top3Tasks = tasks.filter((t) => t.is_top3);
  const inboxTasks = tasks.filter((t) => !t.is_top3);

  const filteredInboxTasks = inboxTasks.filter((task) => {
    if (selectedCategoryFilter === 'ALL') return true;
    return task.category === selectedCategoryFilter;
  });

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

  const formatDueDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
    });
  };

  const isOverdue = (dateStr?: string | null, isCompleted?: boolean): boolean => {
    if (!dateStr || isCompleted) return false;
    return new Date(dateStr) < new Date();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Execution Workspace</h1>
          <p className="text-xs text-gray-500">Synced with Google Tasks • Prioritized locally</p>
        </div>
        <button
          onClick={() => fetchTasks(false)}
          disabled={isSyncing}
          className="text-xs font-semibold px-3 py-1.5 text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition shadow-sm disabled:opacity-50"
        >
          {isSyncing ? 'Syncing...' : '🔄 Sync Google Tasks'}
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      {/* Focus Timer */}
      <PomodoroTimer
        ref={timerRef}
        activeTask={activeFocusTask}
        onCompleteTask={handleToggleComplete}
        onClearActiveTask={() => setActiveFocusTaskId(null)}
      />

      {/* Skeleton / Task List */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-16 bg-gray-200 rounded-xl w-full" />
          <div className="h-16 bg-gray-200 rounded-xl w-full" />
          <div className="h-16 bg-gray-200 rounded-xl w-full" />
        </div>
      ) : (
        <>
          {/* TOP 3 TODAY SECTION */}
          <section className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                ⭐ Top 3 Today
              </h2>
              <span className="text-xs font-semibold px-2.5 py-1 bg-amber-200 text-amber-800 rounded-full">
                {top3Tasks.length} / 3
              </span>
            </div>

            {top3Tasks.length === 0 ? (
              <p className="text-sm text-amber-700 italic py-2">
                No focus items selected yet. Pin up to 3 tasks from your inbox!
              </p>
            ) : (
              <ul className="space-y-2">
                {top3Tasks.map((task) => (
                  <TaskCardItem
                    key={task.google_task_id}
                    task={task}
                    isFocused={activeFocusTaskId === task.google_task_id}
                    onFocusSelect={() => setActiveFocusTaskId(task.google_task_id)}
                    isEditing={editingTaskId === task.google_task_id}
                    editPriority={editPriority}
                    editEstimatedMinutes={editEstimatedMinutes}
                    setEditPriority={setEditPriority}
                    setEditEstimatedMinutes={setEditEstimatedMinutes}
                    startEditing={() => startEditing(task)}
                    cancelEditing={() => setEditingTaskId(null)}
                    saveEditing={() => handleSaveEdit(task)}
                    isExpanded={expandedTaskId === task.google_task_id}
                    onToggleExpand={() => {
                      setExpandedTaskId(
                        expandedTaskId === task.google_task_id ? null : task.google_task_id
                      );
                      setNewStepTitle('');
                    }}
                    newStepTitle={newStepTitle}
                    setNewStepTitle={setNewStepTitle}
                    onAddStep={(e) => handleAddStep(task, e)}
                    onToggleStep={(step) => handleToggleStep(task.google_task_id, step)}
                    onDeleteStep={(stepId) => handleDeleteStep(task.google_task_id, stepId)}
                    onToggleComplete={() => handleToggleComplete(task.google_task_id)}
                    onToggleTop3={() => handleToggleTop3(task)}
                    getPriorityBadge={getPriorityBadge}
                    getCategoryBadge={getCategoryBadge}
                    formatDueDate={formatDueDate}
                    isOverdue={isOverdue(task.due_date, task.is_completed)}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* INBOX SECTION */}
          <section className="space-y-3">
            <div className="flex items-center justify-between pt-2">
              <h2 className="text-lg font-bold text-gray-800">Google Tasks Inbox</h2>

              {/* Dynamic Category Filter Pills */}
              <div className="flex gap-1 overflow-x-auto">
                {availableCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition border ${
                      selectedCategoryFilter === cat
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat === 'ALL' ? 'All' : cat}
                  </button>
                ))}
              </div>
            </div>

            {filteredInboxTasks.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 border border-dashed rounded-xl text-gray-400 text-xs">
                {selectedCategoryFilter === 'ALL'
                  ? 'No active tasks in Google Tasks!'
                  : `No tasks found in ${selectedCategoryFilter}.`}
              </div>
            ) : (
              <ul className="space-y-2">
                {filteredInboxTasks.map((task) => (
                  <TaskCardItem
                    key={task.google_task_id}
                    task={task}
                    isFocused={false}
                    isEditing={editingTaskId === task.google_task_id}
                    editPriority={editPriority}
                    editEstimatedMinutes={editEstimatedMinutes}
                    setEditPriority={setEditPriority}
                    setEditEstimatedMinutes={setEditEstimatedMinutes}
                    startEditing={() => startEditing(task)}
                    cancelEditing={() => setEditingTaskId(null)}
                    saveEditing={() => handleSaveEdit(task)}
                    isExpanded={expandedTaskId === task.google_task_id}
                    onToggleExpand={() => {
                      setExpandedTaskId(
                        expandedTaskId === task.google_task_id ? null : task.google_task_id
                      );
                      setNewStepTitle('');
                    }}
                    newStepTitle={newStepTitle}
                    setNewStepTitle={setNewStepTitle}
                    onAddStep={(e) => handleAddStep(task, e)}
                    onToggleStep={(step) => handleToggleStep(task.google_task_id, step)}
                    onDeleteStep={(stepId) => handleDeleteStep(task.google_task_id, stepId)}
                    onToggleComplete={() => handleToggleComplete(task.google_task_id)}
                    onToggleTop3={() => handleToggleTop3(task)}
                    getPriorityBadge={getPriorityBadge}
                    getCategoryBadge={getCategoryBadge}
                    formatDueDate={formatDueDate}
                    isTop3Disabled={top3Tasks.length >= 3}
                    isOverdue={isOverdue(task.due_date, task.is_completed)}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

interface TaskCardItemProps {
  task: Task;
  isFocused?: boolean;
  onFocusSelect?: () => void;
  isEditing: boolean;
  editPriority: Priority;
  editEstimatedMinutes: string;
  setEditPriority: (val: Priority) => void;
  setEditEstimatedMinutes: (val: string) => void;
  startEditing: () => void;
  cancelEditing: () => void;
  saveEditing: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  newStepTitle: string;
  setNewStepTitle: (val: string) => void;
  onAddStep: (e: React.FormEvent) => void;
  onToggleStep: (step: MicroStep) => void;
  onDeleteStep: (stepId: number) => void;
  onToggleComplete: () => void;
  onToggleTop3: () => void;
  getPriorityBadge: (p: Priority) => string;
  getCategoryBadge: (c: string) => string;
  formatDueDate: (d?: string | null) => string | null;
  isTop3Disabled?: boolean;
  isOverdue?: boolean;
}

const TaskCardItem: React.FC<TaskCardItemProps> = ({
  task,
  isFocused,
  onFocusSelect,
  isEditing,
  editPriority,
  editEstimatedMinutes,
  setEditPriority,
  setEditEstimatedMinutes,
  startEditing,
  cancelEditing,
  saveEditing,
  isExpanded,
  onToggleExpand,
  newStepTitle,
  setNewStepTitle,
  onAddStep,
  onToggleStep,
  onDeleteStep,
  onToggleComplete,
  onToggleTop3,
  getPriorityBadge,
  getCategoryBadge,
  formatDueDate,
  isTop3Disabled,
  isOverdue,
}) => {
  const formattedDue = formatDueDate(task.due_date);
  const completedSteps = task.steps.filter((s) => s.is_done).length;

  return (
    <li
      className={`p-3 border rounded-lg transition ${
        isFocused
          ? 'bg-amber-100/60 border-amber-400 ring-2 ring-amber-400/40 shadow-sm'
          : task.is_top3
          ? 'bg-white border-amber-300 shadow-sm'
          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <input
            type="checkbox"
            checked={task.is_completed}
            onChange={onToggleComplete}
            title="Mark complete in Google Tasks"
            className="w-4 h-4 mt-1 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
          />
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{task.title}</span>
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
              {task.estimated_minutes && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-slate-100 text-slate-700 border-slate-200">
                  ⏱ {task.estimated_minutes}m
                </span>
              )}
              {formattedDue && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                    isOverdue
                      ? 'bg-red-100 text-red-700 border-red-300 animate-pulse'
                      : 'bg-amber-100 text-amber-800 border-amber-200'
                  }`}
                >
                  {isOverdue ? '⚠️ Overdue: ' : '📅 '}
                  {formattedDue}
                </span>
              )}
            </div>

            {task.notes && <p className="text-xs text-gray-600">{task.notes}</p>}

            {/* Inline Execution Metadata Editor */}
            {isEditing && (
              <div className="flex items-center gap-2 flex-wrap pt-2">
                <select
                  value={editPriority}
                  disabled={task.is_top3}
                  onChange={(e) => setEditPriority(e.target.value as Priority)}
                  className="text-xs px-2 py-1 border rounded bg-white"
                >
                  <option value="UNASSIGNED">Unassigned</option>
                  <option value="LOW">Low Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="HIGH">High Priority</option>
                </select>
                <input
                  type="number"
                  min={5}
                  step={5}
                  placeholder="Est. mins"
                  value={editEstimatedMinutes}
                  onChange={(e) => setEditEstimatedMinutes(e.target.value)}
                  className="w-24 text-xs px-2 py-1 border rounded bg-white"
                />
                <button
                  onClick={saveEditing}
                  className="text-xs font-semibold px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={cancelEditing}
                  className="text-xs px-2.5 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {task.is_top3 && onFocusSelect && (
            <button
              onClick={onFocusSelect}
              className={`text-xs font-semibold px-2 py-1 rounded transition ${
                isFocused
                  ? 'bg-slate-900 text-white'
                  : 'bg-amber-200/80 text-amber-900 hover:bg-amber-300'
              }`}
            >
              {isFocused ? '🎯 Focused' : '🎯 Focus'}
            </button>
          )}
          <button
            onClick={onToggleExpand}
            className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-gray-200 transition"
          >
            Steps {task.steps.length > 0 ? `(${completedSteps}/${task.steps.length})` : '+'}
          </button>
          <button
            onClick={startEditing}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition"
          >
            Triage
          </button>
          <button
            onClick={onToggleTop3}
            disabled={!task.is_top3 && isTop3Disabled}
            className={`text-xs font-medium px-2 py-1 rounded transition ${
              task.is_top3
                ? 'text-amber-800 bg-amber-200 hover:bg-amber-300'
                : isTop3Disabled
                ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                : 'text-amber-700 bg-amber-100 hover:bg-amber-200'
            }`}
          >
            {task.is_top3 ? 'Unpin' : '⭐ Pin'}
          </button>
        </div>
      </div>

      {/* Expandable Micro-Steps Breakdown */}
      {(isExpanded || task.steps.length > 0) && (
        <div className="mt-2.5 pl-7 pt-2 border-t border-gray-200/80 space-y-1.5">
          {task.steps.map((step) => (
            <div key={step.id} className="flex items-center justify-between text-xs group">
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={step.is_done}
                  onChange={() => onToggleStep(step)}
                  className="w-3.5 h-3.5 rounded text-emerald-600 cursor-pointer"
                />
                <span className={step.is_done ? 'line-through text-gray-400' : 'text-gray-700'}>
                  {step.title}
                </span>
              </label>
              <button
                onClick={() => onDeleteStep(step.id)}
                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 px-1 transition"
              >
                ✕
              </button>
            </div>
          ))}

          {isExpanded && (
            <form onSubmit={onAddStep} className="flex gap-1.5 pt-1">
              <input
                type="text"
                placeholder="Break down next micro-step..."
                value={newStepTitle}
                onChange={(e) => setNewStepTitle(e.target.value)}
                className="flex-1 text-xs px-2.5 py-1 border rounded bg-white focus:outline-none focus:border-slate-400"
              />
              <button
                type="submit"
                className="text-xs font-semibold px-2.5 py-1 bg-slate-800 text-white rounded hover:bg-slate-900"
              >
                Add
              </button>
            </form>
          )}
        </div>
      )}
    </li>
  );
};