import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { playChime, initAudio } from '../utils/sounds';
import { JournalModal } from './JournalModal';
import { api } from '../api/client';
import type { Task } from '../types/task';

export interface PomodoroTimerRef {
  toggleTimer: () => void;
  resetTimer: () => void;
}

interface PomodoroTimerProps {
  activeTask?: Task | null;
  onCompleteTask?: (googleTaskId: string) => void;
  onClearActiveTask?: () => void;
}

type TimerMode = 'WORK' | 'BREAK';

// Dynamic wellness & recovery micro-prompts
const WELLNESS_PROMPTS = [
  { icon: '💧', title: 'Hydration Reset', body: 'Drink a full glass of water before starting your next block.' },
  { icon: '👀', title: '20-20-20 Eye Rest', body: 'Look at an object 20 feet away for 20 seconds to relieve eye strain.' },
  { icon: '🧘', title: 'Lower Body & Achilles Stretch', body: 'Stand up and perform light calf/ankle wall stretches or gentle toe raises.' },
  { icon: '🫁', title: 'Posture Decompress', body: 'Roll your shoulders backward 5 times and take 3 deep belly breaths.' },
  { icon: '🖐️', title: 'Wrist & Forearm Stretch', body: 'Extend your arms and gently flex your wrists up and down for 15 seconds.' },
  { icon: '🌬️', title: 'Box Breathing Reset', body: 'Inhale 4s, hold 4s, exhale 4s, hold 4s. Repeat 3 times to lower stress.' },
  { icon: '🚶', title: 'Micro-Movement', body: 'Step away from your screen and take a short 1-minute walk around the room.' },
];

export const PomodoroTimer = forwardRef<PomodoroTimerRef, PomodoroTimerProps>(
  ({ activeTask, onClearActiveTask }, ref) => {
    const WORK_TIME = 25 * 60;
    const BREAK_TIME = 5 * 60;

    const [mode, setMode] = useState<TimerMode>('WORK');
    const [timeLeft, setTimeLeft] = useState<number>(WORK_TIME);
    const [isRunning, setIsRunning] = useState<boolean>(false);
    const [isJournalOpen, setIsJournalOpen] = useState<boolean>(false);
    const [completedSessionId, setCompletedSessionId] = useState<number | null>(null);

    // Track active wellness prompt index during break mode
    const [promptIndex, setPromptIndex] = useState<number>(0);

    useImperativeHandle(ref, () => ({
      toggleTimer: () => {
        initAudio();
        setIsRunning((prev) => !prev);
      },
      resetTimer: () => {
        setIsRunning(false);
        setTimeLeft(mode === 'WORK' ? WORK_TIME : BREAK_TIME);
      },
    }));

    // Rotate wellness prompt when entering break mode
    useEffect(() => {
      if (mode === 'BREAK') {
        setPromptIndex(Math.floor(Math.random() * WELLNESS_PROMPTS.length));
      }
    }, [mode]);

    useEffect(() => {
      let interval: number | null = null;

      if (isRunning && timeLeft > 0) {
        interval = setInterval(() => {
          setTimeLeft((prev) => prev - 1);
        }, 1000);
      } else if (isRunning && timeLeft === 0) {
        setIsRunning(false);
        playChime();

        if (mode === 'WORK') {
          handleWorkComplete();
        } else {
          setMode('WORK');
          setTimeLeft(WORK_TIME);
        }
      }

      return () => {
        if (interval) clearInterval(interval);
      };
    }, [isRunning, timeLeft, mode]);

    const handleWorkComplete = async () => {
      try {
        const response = await api.post('/sessions', {
          duration_minutes: 25,
          google_task_id: activeTask ? activeTask.google_task_id : null,
          task_title: activeTask ? activeTask.title : null,
          category_name: activeTask ? activeTask.category : null,
          notes: null,
        });

        setCompletedSessionId(response.data.id);
        setIsJournalOpen(true);
      } catch (err) {
        console.error('Failed to log focus session:', err);
      }

      setMode('BREAK');
      setTimeLeft(BREAK_TIME);
    };

    const handleJournalSaved = () => {
      setIsJournalOpen(false);
      setCompletedSessionId(null);
    };

    const togglePlay = () => {
      initAudio();
      setIsRunning((prev) => !prev);
    };

    const handleModeSwitch = (newMode: TimerMode) => {
      setIsRunning(false);
      setMode(newMode);
      setTimeLeft(newMode === 'WORK' ? WORK_TIME : BREAK_TIME);
    };

    const currentPrompt = WELLNESS_PROMPTS[promptIndex];

    const formatTime = (seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
      <div className="p-6 bg-slate-900 text-white rounded-2xl shadow-lg border border-slate-800 space-y-4">
        {/* Mode Switcher */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex gap-2">
            <button
              onClick={() => handleModeSwitch('WORK')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                mode === 'WORK'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              🧠 Focus Mode (25m)
            </button>
            <button
              onClick={() => handleModeSwitch('BREAK')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                mode === 'BREAK'
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              🌿 Wellness Break (5m)
            </button>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {isRunning ? '🟢 Active' : '⏸ Paused'}
          </span>
        </div>

        {/* Active Task Link Banner */}
        {activeTask && mode === 'WORK' && (
          <div className="flex items-center justify-between bg-slate-800/80 px-3 py-2 rounded-lg border border-amber-400/30">
            <span className="text-xs text-amber-300 font-medium truncate">
              🎯 Focusing on: <strong className="text-white">{activeTask.title}</strong>
            </span>
            <button
              onClick={onClearActiveTask}
              className="text-[10px] text-slate-400 hover:text-white underline ml-2"
            >
              Detach
            </button>
          </div>
        )}

        {/* Big Timer Display */}
        <div className="text-center py-2">
          <div className="text-6xl font-black tracking-tight font-mono text-white">
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Wellness Prompt Box (Active during Break) */}
        {mode === 'BREAK' && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl space-y-1 animate-fade-in">
            <div className="flex items-center justify-between text-emerald-300 text-xs font-bold">
              <span className="flex items-center gap-1.5">
                <span>{currentPrompt.icon}</span> {currentPrompt.title}
              </span>
              <button
                onClick={() => setPromptIndex((prev) => (prev + 1) % WELLNESS_PROMPTS.length)}
                className="text-[10px] text-emerald-400 hover:underline"
              >
                🔄 Next Prompt
              </button>
            </div>
            <p className="text-xs text-emerald-100/90 leading-relaxed">
              {currentPrompt.body}
            </p>
          </div>
        )}

        {/* Timer Control Buttons */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={togglePlay}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition shadow-md ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
            }`}
          >
            {isRunning ? '⏸ Pause' : '▶ Start Focus'}
          </button>
          <button
            onClick={() => {
              setIsRunning(false);
              setTimeLeft(mode === 'WORK' ? WORK_TIME : BREAK_TIME);
            }}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-xs transition"
          >
            ↺ Reset
          </button>
        </div>

        {/* Reflection Journal Modal */}
        <JournalModal
          isOpen={isJournalOpen}
          sessionId={completedSessionId}
          taskTitle={activeTask?.title}
          onSave={handleJournalSaved}
          onSkip={() => setIsJournalOpen(false)}
        />
      </div>
    );
  }
);