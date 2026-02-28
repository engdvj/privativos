import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToastContext, type ToastVariant } from "@/components/ui/toast-context";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  isClosing: boolean;
}

const TOAST_TTL_MS = 3400;
const TOAST_EXIT_MS = 180;

const variantClassName: Record<ToastVariant, string> = {
  success: "border-success/30 bg-success/14 text-foreground",
  error: "border-destructive/30 bg-destructive/14 text-foreground",
  info: "border-primary/30 bg-primary/14 text-foreground",
};

const variantIcon = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const startToastClose = useCallback(
    (id: number) => {
      setToasts((current) =>
        current.map((toast) => (toast.id === id ? { ...toast, isClosing: true } : toast)),
      );

      window.setTimeout(() => {
        removeToast(id);
      }, TOAST_EXIT_MS);
    },
    [removeToast],
  );

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, variant, isClosing: false }]);

      window.setTimeout(() => {
        startToastClose(id);
      }, TOAST_TTL_MS);
    },
    [startToastClose],
  );

  const value = useMemo(
    () => ({
      showToast,
      success: (message: string) => showToast(message, "success"),
      error: (message: string) => showToast(message, "error"),
      info: (message: string) => showToast(message, "info"),
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => {
          const Icon = variantIcon[toast.variant];

          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm shadow-lg backdrop-blur",
                toast.isClosing
                  ? "animate-out fade-out-0 slide-out-to-right-2"
                  : "animate-in fade-in-0 slide-in-from-right-2",
                variantClassName[toast.variant],
              )}
              role="status"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="leading-snug">{toast.message}</p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
