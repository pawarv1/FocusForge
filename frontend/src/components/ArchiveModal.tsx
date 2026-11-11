import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { Task, Priority } from '../types/task';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskRestored: (task: Task) => void;
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({
  isOpen,
  onClose,
  onTaskRestored,
}) => {
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const fetchArchived = async () => {
        try {
          setIsLoading(true);
          const response = await api.get<Task[]>('/tasks/archived');
          setArchivedTasks(response.data);
        } catch (err) {
          console.error('Error fetching archived tasks:', err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchArchived();
    }
  }, [isOpen]);

  const handleRestore = async (id: number) => {
    try {
      const response = await api.patch<Task>(`/tasks/${id}/unarchive`);
      setArchivedTasks((prev) => prev.filter((t) => t.id !== id));
      onTaskRestored(response.data);
    } catch (err) {
      console.error('Error unarchiving task:', err);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-xl font-bold text-gray-800">📁 Archived Tasks</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 font-bold text-lg"
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-gray-500">Loading archive...</div>
        ) : archivedTasks.length === 0 ? (
          <div className="py-8 text-center text-gray-400">No archived tasks found.</div>
        ) : (
          <ul className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {archivedTasks.map((task) => {
              const formattedDue = formatDueDate(task.due_date);
              return (
                <li
                  key={task.id}
                  className="flex items-start justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 gap-3"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-700 line-through">
                        {task.title}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPriorityBadge(
                          task.priority
                        )}`}
                      >
                        {task.priority}
                      </span>
                      {formattedDue && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                          📅 {formattedDue}
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-xs text-gray-500 line-through">
                        {task.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRestore(task.id)}
                    className="text-xs font-semibold px-2.5 py-1 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition shrink-0"
                  >
                    ↩️ Restore
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};