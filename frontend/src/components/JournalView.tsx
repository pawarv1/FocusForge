import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

type TaskCategory = 'COURSEWORK' | 'RESEARCH' | 'DEVELOPMENT' | 'CAREER' | 'OTHER';

interface JournalEntry {
  id: number;
  task_title?: string | null;
  task_category?: TaskCategory | string | null;
  duration_minutes: number;
  completed_at: string;
  notes: string;
}

const TASK_CATEGORY_STYLES: Record<TaskCategory, { label: string; classes: string }> = {
  COURSEWORK: {
    label: 'Coursework',
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  RESEARCH: {
    label: 'Research',
    classes: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  DEVELOPMENT: {
    label: 'Development',
    classes: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  CAREER: {
    label: 'Career',
    classes: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  OTHER: {
    label: 'Other',
    classes: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

export const JournalView: React.FC = () => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
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

  const getCategoryMeta = (category?: string | null) => {
    if (!category) return null;
    const key = category.toUpperCase() as TaskCategory;
    return (
      TASK_CATEGORY_STYLES[key] ?? {
        label: category,
        classes: 'bg-slate-100 text-slate-700 border-slate-200',
      }
    );
  };

  const filteredEntries = entries.filter((e) => {
    const matchesCategory =
      selectedCategory === 'ALL' || e.task_category?.toUpperCase() === selectedCategory;

    const query = search.toLowerCase();
    const matchesQuery =
      e.notes.toLowerCase().includes(query) ||
      (e.task_title && e.task_title.toLowerCase().includes(query)) ||
      (e.task_category && e.task_category.toLowerCase().includes(query));

    return matchesCategory && matchesQuery;
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
          placeholder="Search reflections, tasks, or categories..."
          className="px-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
            selectedCategory === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          All
        </button>
        {(Object.keys(TASK_CATEGORY_STYLES) as TaskCategory[]).map((cat) => {
          const meta = TASK_CATEGORY_STYLES[cat];
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-20 bg-gray-200 rounded-xl" />
          <div className="h-20 bg-gray-200 rounded-xl" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 border border-dashed rounded-xl text-gray-400 text-sm">
          No reflection notes match your current filter. Complete a Pomodoro work block to record your accomplishments!
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => {
            const categoryMeta = getCategoryMeta(entry.task_category);

            return (
              <div
                key={entry.id}
                className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      ⏱ {entry.duration_minutes}m Focus Block
                    </span>
                    {categoryMeta && (
                      <span
                        className={`font-semibold px-2 py-0.5 rounded border ${categoryMeta.classes}`}
                      >
                        {categoryMeta.label}
                      </span>
                    )}
                  </div>
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
            );
          })}
        </div>
      )}
    </div>
  );
};