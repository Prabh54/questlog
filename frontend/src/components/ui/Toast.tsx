import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/cn';
import { ApiError } from '../../lib/api';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
  duration?: number; // ms; 0 = persistent
}

interface ToastContextValue {
  toast: {
    success: (message: string, opts?: Omit<ToastInput, 'message' | 'variant'>) => void;
    error: (message: string, opts?: Omit<ToastInput, 'message' | 'variant'>) => void;
    warning: (message: string, opts?: Omit<ToastInput, 'message' | 'variant'>) => void;
    info: (message: string, opts?: Omit<ToastInput, 'message' | 'variant'>) => void;
  };
  push: (t: ToastInput) => void;
  dismiss: (id: string) => void;
}

interface ToastInput {
  variant: ToastVariant;
  title?: string;
  message: string;
  duration?: number;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const qc = useQueryClient();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = Math.random().toString(36).slice(2);
      const duration = input.duration ?? (input.variant === 'error' ? 6000 : 4000);
      const next: Toast = { id, ...input };
      setToasts((prev) => [...prev, next]);
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
    },
    [dismiss],
  );

  // Auto-toast mutation errors (unless opted out via meta.silentError)
  useEffect(() => {
    const cache = qc.getMutationCache();
    const unsub = cache.subscribe((event) => {
      if (
        event.type !== 'updated' ||
        event.action?.type !== 'error' ||
        event.mutation.meta?.silentError
      ) {
        return;
      }
      const err = event.mutation.state.error;
      if (!err) return;

      let message: string;
      if (err instanceof ApiError) {
        // Friendlier messaging for well-known codes
        const codeMap: Record<string, string> = {
          ALREADY_COMPLETED_TODAY: 'Already completed for this period',
          QUEST_ARCHIVED: 'Quest is archived',
          USERNAME_TAKEN: 'That display name is taken',
          EMAIL_TAKEN: 'That email is already registered',
          VALIDATION_FAILED: 'Please check the form and try again',
        };
        message = codeMap[err.code] ?? err.message;
      } else if (err instanceof Error) {
        message = err.message || 'Something went wrong';
      } else {
        message = 'Something went wrong';
      }

      push({ variant: 'error', message });
    });
    return unsub;
  }, [qc, push]);

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      dismiss,
      toast: {
        success: (message, opts) => push({ ...opts, variant: 'success', message }),
        error: (message, opts) => push({ ...opts, variant: 'error', message }),
        warning: (message, opts) => push({ ...opts, variant: 'warning', message }),
        info: (message, opts) => push({ ...opts, variant: 'info', message }),
      },
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ── Viewport ──────────────────────────────────────────────────────────────
const VARIANT_STYLES: Record<
  ToastVariant,
  { icon: typeof CheckCircle2; ring: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle2,
    ring: 'border-success-500/40 bg-success-500/10',
    iconClass: 'text-success-400',
  },
  error: {
    icon: AlertCircle,
    ring: 'border-danger-500/40 bg-danger-500/10',
    iconClass: 'text-danger-400',
  },
  warning: {
    icon: AlertTriangle,
    ring: 'border-warning-500/40 bg-warning-500/10',
    iconClass: 'text-warning-400',
  },
  info: {
    icon: Info,
    ring: 'border-primary-500/40 bg-primary-500/10',
    iconClass: 'text-primary-400',
  },
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto sm:max-w-sm"
    >
      {toasts.map((t) => {
        const { icon: Icon, ring, iconClass } = VARIANT_STYLES[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto w-full rounded-lg border bg-surface-900/95 backdrop-blur px-4 py-3 shadow-lg animate-fade-in',
              ring,
            )}
          >
            <div className="flex items-start gap-3">
              <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', iconClass)} />
              <div className="min-w-0 flex-1">
                {t.title && (
                  <p className="text-sm font-semibold text-surface-50">{t.title}</p>
                )}
                <p className="text-sm text-surface-200">{t.message}</p>
              </div>
              <button
                onClick={() => onDismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 text-surface-500 hover:text-surface-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
