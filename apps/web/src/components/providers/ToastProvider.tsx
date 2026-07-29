import { CheckCircle, Info, WarningCircle, X, XCircle } from "@phosphor-icons/react";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils/cn";

export type ToastTone = "success" | "info" | "warning" | "danger";

type ToastInput = {
  tone?: ToastTone;
  title: string;
  description?: string;
  duration?: number;
};

type ToastItem = ToastInput & {
  id: number;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
  dismissToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClasses: Record<ToastTone, string> = {
  success: "border-status-success/25 bg-status-success-surface text-status-success",
  info: "border-status-info/25 bg-status-info-surface text-status-info",
  warning: "border-status-warning/25 bg-status-warning-surface text-status-warning",
  danger: "border-status-danger/25 bg-status-danger-surface text-status-danger",
};

const toneIcons = {
  success: CheckCircle,
  info: Info,
  warning: WarningCircle,
  danger: XCircle,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const recentToast = useRef<{ key: string; shownAt: number } | null>(null);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ tone = "info", title, description, duration = 4500 }: ToastInput) => {
      const normalizedTitle = title.trim();
      const normalizedDescription = description?.trim();
      if (!normalizedTitle) return;

      const key = `${tone}|${normalizedTitle}|${normalizedDescription || ""}`;
      const now = Date.now();
      if (recentToast.current?.key === key && now - recentToast.current.shownAt < 2000) return;
      recentToast.current = { key, shownAt: now };

      const id = nextId.current++;
      setToasts((current) => [
        ...current.filter(
          (toast) =>
            `${toast.tone || "info"}|${toast.title}|${toast.description || ""}` !== key,
        ),
        { id, tone, title: normalizedTitle, description: normalizedDescription, duration },
      ].slice(-3));

      window.setTimeout(() => dismissToast(id), duration);
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-24 z-[90] flex flex-col items-end gap-3 sm:left-auto sm:w-[420px]"
        aria-label="Notifications"
      >
        {toasts.map((toast) => {
          const tone = toast.tone || "info";
          const Icon = toneIcons[tone];
          return (
            <div
              key={toast.id}
              role={tone === "danger" ? "alert" : "status"}
              aria-live={tone === "danger" ? "assertive" : "polite"}
              className={cn(
                "pointer-events-auto w-full rounded-lg border p-4 shadow-overlay",
                "motion-safe:animate-[toast-in_180ms_var(--ease-out)]",
                toneClasses[tone],
              )}
            >
              <div className="flex items-start gap-3">
                <Icon size={22} weight="bold" className="mt-0.5 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text-primary">{toast.title}</p>
                  {toast.description ? (
                    <p className="mt-1 text-sm leading-5 text-text-secondary">{toast.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-surface/70 hover:text-text-primary"
                  aria-label={`Dismiss ${toast.title}`}
                  onClick={() => dismissToast(toast.id)}
                >
                  <X size={18} weight="bold" aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
