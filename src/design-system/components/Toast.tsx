import { useEffect } from 'react';

export interface ToastProps {
  message: string;
  action?: { label: string; onClick: () => void };
  onDismiss: () => void;
  /** Auto-dismiss after this many ms. Default 6000. */
  duration?: number;
}

/** A short confirmation at the bottom of the screen, with an optional Undo. */
export function Toast({ message, action, onDismiss, duration = 6000 }: ToastProps) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(t);
  }, [message, duration, onDismiss]);
  return (
    <div className="nb-toast" role="status">
      <span>{message}</span>
      {action ? (
        <button
          type="button"
          className="nb-toast-action"
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
