import React, { useState } from 'react';
import type { Priority, Category } from '../types/task';

interface TaskInputProps {
  onAddTask: (taskData: {
    title: string;
    description: string | null;
    priority: Priority;
    category: Category;
    due_date: string | null;
  }) => Promise<void>;
}

export const TaskInput: React.FC<TaskInputProps> = ({ onAddTask }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [category, setCategory] = useState<Category>('DEVELOPMENT');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onAddTask({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        category,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      });

      // Reset form on success
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setCategory('DEVELOPMENT');
      setDueDate('');
    } catch (err) {
      console.error('Failed to add task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3 shadow-sm">
      <div className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Capture a work task or research item... (Cmd/Ctrl+Enter to add)"
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          required
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="px-3 py-2 border rounded-lg bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="DEVELOPMENT">💻 Dev</option>
          <option value="RESEARCH">🔬 Research</option>
          <option value="COURSEWORK">📚 Class</option>
          <option value="CAREER">🎯 Career</option>
          <option value="OTHER">📌 Other</option>
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className="px-3 py-2 border rounded-lg bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Med</option>
          <option value="HIGH">High</option>
        </select>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm disabled:opacity-50"
        >
          {isSubmitting ? 'Adding...' : 'Add Task'}
        </button>
      </div>

      <div className="flex gap-2">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Key details, links, or notes (optional)..."
          rows={1}
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
        />
        <input
          type="datetime-local"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="px-3 py-2 border rounded-lg bg-white text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 self-start"
        />
      </div>
    </form>
  );
};