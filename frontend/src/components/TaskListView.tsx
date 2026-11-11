import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { TaskInput } from './TaskInput';
import { PomodoroTimer, type PomodoroTimerRef } from './PomodoroTimer';
import { ArchiveModal } from './ArchiveModal';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import type { Task, Priority, Category } from '../types/task';

export const TaskListView: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState<boolean>(false);

  // Focus tracking state
  const [activeFocusTaskId, setActiveFocusTaskId] = useState<number | null>(null);

  // Category filter state
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<Category | 'ALL'>('ALL');

  // Refs
  const timerRef = useRef<PomodoroTimerRef>(null);

  // Inline editing state
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editPriority, setEditPriority] = useState<Priority>('MEDIUM');
  const [editCategory, setEditCategory] = useState<Category>('DEVELOPMENT');
  const [editDueDate, setEditDueDate] = useState<string>('');

  // Global Keyboard Shortcuts
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
      if (isArchiveOpen) {
        setIsArchiveOpen(false);
      }
    },
  });

  // Fetch initial tasks
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await api.get<Task[]>('/tasks');
        setTasks(response.data);
      } catch (err) {
        console.error('Error fetching tasks:', err);
        setError('Could not load tasks. Is the backend server running?');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const activeFocusTask = tasks.find((t) => t.id === activeFocusTaskId) || null;

  // 1. Add Task
  const handleAddTask = async (taskData: {
    title: string;
    description: string | null;
    priority: Priority;
    category: Category;
    due_date: string | null;
  }) => {
    try {
      setError(null);
      const response = await api.post<Task>('/tasks', taskData);
      setTasks((prev) => [...prev, response.data]);
    } catch (err) {
      console.error('Error creating task:', err);
      setError('Failed to create task.');
      throw err;
    }
  };

  // 2. Delete Task
  const handleDeleteTask = async (id: number) => {
    try {
      await api.delete(`/tasks/${id}`);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (activeFocusTaskId === id) {
        setActiveFocusTaskId(null);
      }
    } catch (err) {
      console.error('Error deleting task:', err);
      setError('Failed to delete task.');
    }
  };

  // 3. Toggle Top 3 Status
  const handleToggleTop3 = async (task: Task) => {
    const currentTop3Count = tasks.filter((t) => t.is_top3).length;

    if (!task.is_top3 && currentTop3Count >= 3) {
      setError('You can only select up to 3 focus tasks for Today!');
      return;
    }

    try {
      setError(null);
      const response = await api.patch<Task>(`/tasks/${task.id}/top3`);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? response.data : t)));

      if (task.is_top3 && activeFocusTaskId === task.id) {
        setActiveFocusTaskId(null);
      }
    } catch (err: any) {
      console.error('Error toggling Top 3 status:', err);
      const msg = err.response?.data?.detail || 'Failed to update priority status.';
      setError(msg);
    }
  };

  // 4. Toggle Completion
  const handleToggleComplete = async (id: number) => {
    try {
      const response = await api.patch<Task>(`/tasks/${id}/complete`);
      setTasks((prev) => prev.map((t) => (t.id === id ? response.data : t)));

      if (activeFocusTaskId === id) {
        setActiveFocusTaskId(null);
      }
    } catch (err) {
      console.error('Error toggling completion:', err);
      setError('Failed to update completion status.');
    }
  };

  // 5. Inline Edit Controls
  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority);
    setEditCategory(task.category);
    setEditDueDate(
      task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : ''
    );
  };

  const handleSaveEdit = async (id: number) => {
    try {
      setError(null);
      const response = await api.patch<Task>(`/tasks/${id}`, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        priority: editPriority,
        category: editCategory,
        due_date: editDueDate ? new Date(editDueDate).toISOString() : null,
      });
      setTasks((prev) => prev.map((t) => (t.id === id ? response.data : t)));
      setEditingTaskId(null);
    } catch (err: any) {
      console.error('Error updating task:', err);
      const msg = err.response?.data?.detail || 'Failed to update task.';
      setError(msg);
    }
  };

  // 6. Clear Completed
  const handleClearCompleted = async () => {
    try {
      const response = await api.post<Task[]>('/tasks/clear-completed');
      setTasks(response.data);
      if (activeFocusTask?.is_completed) {
        setActiveFocusTaskId(null);
      }
    } catch (err) {
      console.error('Error clearing completed tasks:', err);
      setError('Failed to clear completed tasks.');
    }
  };

  const handleTaskRestored = (restoredTask: Task) => {
    setTasks((prev) => [...prev, restoredTask]);
  };

  const top3Tasks = tasks.filter((t) => t.is_top3);
  const inboxTasks = tasks.filter((t) => !t.is_top3);

  // Filter inbox tasks by category pill
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

  const formatDueDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
        <h1 className="text-2xl font-bold text-gray-900">Task Workspace</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setIsArchiveOpen(true)}
            className="text-xs font-semibold px-3 py-1.5 text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition"
          >
            📁 View Archive
          </button>
          {tasks.some((t) => t.is_completed) && (
            <button
              onClick={handleClearCompleted}
              className="text-xs font-semibold px-3 py-1.5 text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition"
            >
              Clear Completed
            </button>
          )}
        </div>
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

      {/* Task Input Form */}
      <TaskInput onAddTask={handleAddTask} />

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
                    key={task.id}
                    task={task}
                    isFocused={activeFocusTaskId === task.id}
                    onFocusSelect={() => setActiveFocusTaskId(task.id)}
                    isEditing={editingTaskId === task.id}
                    editTitle={editTitle}
                    editDescription={editDescription}
                    editPriority={editPriority}
                    editCategory={editCategory}
                    editDueDate={editDueDate}
                    setEditTitle={setEditTitle}
                    setEditDescription={setEditDescription}
                    setEditPriority={setEditPriority}
                    setEditCategory={setEditCategory}
                    setEditDueDate={setEditDueDate}
                    startEditing={() => startEditing(task)}
                    cancelEditing={() => setEditingTaskId(null)}
                    saveEditing={() => handleSaveEdit(task.id)}
                    onToggleComplete={() => handleToggleComplete(task.id)}
                    onToggleTop3={() => handleToggleTop3(task)}
                    onDelete={() => handleDeleteTask(task.id)}
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
              <h2 className="text-lg font-bold text-gray-800">Inbox</h2>

              {/* Category Filter Pills */}
              <div className="flex gap-1 overflow-x-auto">
                {(['ALL', 'DEVELOPMENT', 'RESEARCH', 'COURSEWORK', 'CAREER', 'OTHER'] as const).map((cat) => (
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
                  ? 'Inbox is empty!'
                  : `No tasks found in ${selectedCategoryFilter} category.`}
              </div>
            ) : (
              <ul className="space-y-2">
                {filteredInboxTasks.map((task) => (
                  <TaskCardItem
                    key={task.id}
                    task={task}
                    isFocused={false}
                    isEditing={editingTaskId === task.id}
                    editTitle={editTitle}
                    editDescription={editDescription}
                    editPriority={editPriority}
                    editCategory={editCategory}
                    editDueDate={editDueDate}
                    setEditTitle={setEditTitle}
                    setEditDescription={setEditDescription}
                    setEditPriority={setEditPriority}
                    setEditCategory={setEditCategory}
                    setEditDueDate={setEditDueDate}
                    startEditing={() => startEditing(task)}
                    cancelEditing={() => setEditingTaskId(null)}
                    saveEditing={() => handleSaveEdit(task.id)}
                    onToggleComplete={() => handleToggleComplete(task.id)}
                    onToggleTop3={() => handleToggleTop3(task)}
                    onDelete={() => handleDeleteTask(task.id)}
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

      {/* Archive Modal */}
      <ArchiveModal
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        onTaskRestored={handleTaskRestored}
      />
    </div>
  );
};

// Sub-component for Task Card
interface TaskCardItemProps {
  task: Task;
  isFocused?: boolean;
  onFocusSelect?: () => void;
  isEditing: boolean;
  editTitle: string;
  editDescription: string;
  editPriority: Priority;
  editCategory: Category;
  editDueDate: string;
  setEditTitle: (val: string) => void;
  setEditDescription: (val: string) => void;
  setEditPriority: (val: Priority) => void;
  setEditCategory: (val: Category) => void;
  setEditDueDate: (val: string) => void;
  startEditing: () => void;
  cancelEditing: () => void;
  saveEditing: () => void;
  onToggleComplete: () => void;
  onToggleTop3: () => void;
  onDelete: () => void;
  getPriorityBadge: (p: Priority) => string;
  getCategoryBadge: (c: Category) => string;
  formatDueDate: (d?: string | null) => string | null;
  isTop3Disabled?: boolean;
  isOverdue?: boolean;
}

const TaskCardItem: React.FC<TaskCardItemProps> = ({
  task,
  isFocused,
  onFocusSelect,
  isEditing,
  editTitle,
  editDescription,
  editPriority,
  editCategory,
  editDueDate,
  setEditTitle,
  setEditDescription,
  setEditPriority,
  setEditCategory,
  setEditDueDate,
  startEditing,
  cancelEditing,
  saveEditing,
  onToggleComplete,
  onToggleTop3,
  onDelete,
  getPriorityBadge,
  getCategoryBadge,
  formatDueDate,
  isTop3Disabled,
  isOverdue,
}) => {
  if (isEditing) {
    return (
      <li className="p-3 bg-blue-50 border border-blue-300 rounded-lg space-y-2">
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="w-full px-3 py-1.5 border rounded bg-white text-sm"
        />
        <textarea
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          className="w-full px-3 py-1.5 border rounded bg-white text-xs"
          rows={2}
        />
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          <div className="flex gap-2">
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value as Category)}
              className="text-xs px-2 py-1 border rounded bg-white font-medium"
            >
              <option value="DEVELOPMENT">💻 Dev</option>
              <option value="RESEARCH">🔬 Research</option>
              <option value="COURSEWORK">📚 Class</option>
              <option value="CAREER">🎯 Career</option>
              <option value="OTHER">📌 Other</option>
            </select>
            <select
              value={editPriority}
              disabled={task.is_top3}
              onChange={(e) => setEditPriority(e.target.value as Priority)}
              className="text-xs px-2 py-1 border rounded bg-white"
            >
              <option value="LOW">Low Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="HIGH">High Priority</option>
            </select>
            <input
              type="datetime-local"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              className="text-xs px-2 py-1 border rounded bg-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveEditing}
              className="text-xs font-semibold px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={cancelEditing}
              className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </li>
    );
  }

  const formattedDue = formatDueDate(task.due_date);

  return (
    <li
      className={`p-3 border rounded-lg transition ${
        task.is_completed
          ? 'bg-gray-100 opacity-60 border-gray-200'
          : isFocused
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
            className="w-4 h-4 mt-1 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`font-semibold ${
                  task.is_completed ? 'line-through text-gray-400' : 'text-gray-900'
                }`}
              >
                {task.title}
              </span>
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
            {task.description && (
              <p
                className={`text-xs ${
                  task.is_completed ? 'line-through text-gray-400' : 'text-gray-600'
                }`}
              >
                {task.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {task.is_top3 && !task.is_completed && onFocusSelect && (
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
            onClick={startEditing}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition"
          >
            Edit
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
          <button
            onClick={onDelete}
            className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50 transition"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
};