import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

interface JournalEntry {
  id: number;
  task_title?: string | null;
  duration_minutes: number;
  completed_at: string;
  notes: string;
}

export const JournalView: React.FC = () => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchJournal = async () => {
      try {
        setIsLoading(true);
        const res = await api.get<JournalEntry[]>('/sessions/journal');
        setEntries(res.data);
      } catch (err) {
        console.error('Failed to fetch journal entries:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchJournal();
  }, []);

  const filteredEntries = entries.filter(
    (e) =>
      e.notes.toLowerCase().includes(search.toLowerCase()) ||
      (e.task_title && e.task_title.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reflection Log</h2>
          <p className="text-xs text-gray-500">
            Micro-journal entries captured upon completing focus sessions
          </p>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reflections or tasks..."
          className="px-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-20 bg-gray-200 rounded-xl" />
          <div className="h-20 bg-gray-200 rounded-xl" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 border border-dashed rounded-xl text-gray-400 text-sm">
          No reflection notes found yet. Complete a Pomodoro work block to record your accomplishments!
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-2"
            >
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  ⏱ {entry.duration_minutes}m Focus Block
                </span>
                <span>{new Date(entry.completed_at).toLocaleString()}</span>
              </div>
              {entry.task_title && (
                <div className="text-xs font-semibold text-slate-700">
                  Task: <span className="text-blue-600">{entry.task_title}</span>
                </div>
              )}
              <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-100 italic">
                "{entry.notes}"
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};