import React from 'react';

export type NavTab = 'tasks' | 'reminders' | 'journal' | 'analytics';

interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  appName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  appName = 'FocusForge',
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-sm">
      <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* App Branding */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center font-black text-slate-950 text-base shadow-sm">
            ⚡
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base text-white tracking-tight leading-none">
              {appName}
            </span>
            <span className="text-[10px] text-slate-400 font-mono pt-0.5">
              Deep Work Engine
            </span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <nav className="flex bg-slate-800/90 p-1 rounded-xl border border-slate-700/60 shadow-inner">
          <button
            onClick={() => onTabChange('tasks')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'tasks'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📋 Workspace
          </button>
          <button
            onClick={() => onTabChange('reminders')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'reminders'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🔔 Reminders
          </button>
          <button
            onClick={() => onTabChange('journal')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'journal'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📖 Journal
          </button>
          <button
            onClick={() => onTabChange('analytics')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'analytics'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📊 Analytics
          </button>
        </nav>
      </div>

      {/* Keyboard Shortcut Sub-Bar */}
      <div className="bg-slate-950/80 border-t border-slate-800/60 py-1 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-end gap-4 text-[10px] text-slate-400 font-mono">
          <span><kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">Space</kbd> Start/Pause Timer</span>
          <span><kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">Cmd/Ctrl+Enter</kbd> Save Step / Note</span>
          <span><kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">Esc</kbd> Cancel / Close</span>
        </div>
      </div>
    </header>
  );
};