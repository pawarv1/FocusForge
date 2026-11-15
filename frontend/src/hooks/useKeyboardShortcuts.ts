import { useEffect } from 'react';

interface ShortcutHandlers {
  onToggleTimer?: () => void;
  onSubmitForm?: () => void;
  onEscape?: () => void;
}

export const useKeyboardShortcuts = ({
  onToggleTimer,
  onSubmitForm,
  onEscape,
}: ShortcutHandlers) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement;

      // Escape key (Closes / Cancels active inline inputs or modals)
      if (e.key === 'Escape') {
        if (onEscape) {
          e.preventDefault();
          onEscape();
        }
        return;
      }

      // Cmd/Ctrl + Enter (Submits active form/input)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (onSubmitForm) {
          e.preventDefault();
          onSubmitForm();
        }
        return;
      }

      // Spacebar (Toggles Pomodoro timer only when NOT typing in an input)
      if (e.code === 'Space' && !isInputFocused) {
        if (onToggleTimer) {
          e.preventDefault();
          onToggleTimer();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleTimer, onSubmitForm, onEscape]);
};