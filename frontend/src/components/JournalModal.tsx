import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

interface JournalModalProps {
  isOpen: boolean;
  sessionId: number | null;
  taskTitle?: string | null;
  durationMinutes?: number;
  onSave: () => void;
  onSkip: () => void;
}

export const JournalModal: React.FC<JournalModalProps> = ({
  isOpen,
  sessionId,
  taskTitle,
  durationMinutes = 25,
  onSave,
  onSkip,
}) => {
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) setNotes('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) {
      onSave();
      return;
    }

    try {
      setIsSubmitting(true);
      // Update session with reflection notes
      await api.patch(`/sessions/${sessionId}`, {
        notes: notes.trim() || null,
      });
      onSave();
    } catch (err) {
      console.error('Failed to save session reflection:', err);
      // Fail gracefully so user can proceed
      onSave();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">
              🎉 {durationMinutes}m Focus Session Complete
            </span>
            <span className="text-[10px] text-slate-400">Esc to skip</span>
          </div>
          <h2 className="text-xl font-bold text-white pt-2">
            What did you accomplish?
          </h2>
          {taskTitle && (
            <p className="text-xs text-slate-400">
              Task: <span className="text-amber-300 font-medium">{taskTitle}</span>
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="E.g., Fixed date bug in main.py and wrote tests..."
            rows={3}
            autoFocus
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
          />

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">
              Press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">Cmd/Ctrl + Enter</kbd> to save
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onSkip}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition disabled:opacity-50"
              >
                Skip
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition shadow-md disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Reflection'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};