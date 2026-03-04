import { type ComponentType, type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  description?: string;
  maxWidthClassName?: string;
  icon?: ComponentType<{ className?: string }>;
  footer?: ReactNode;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function Modal({
  open,
  title,
  onClose,
  children,
  description,
  maxWidthClassName = "max-w-3xl",
  icon: Icon,
  footer,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    if (!panel) return;

    const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const autoFocusTarget = panel.querySelector<HTMLElement>("[data-autofocus]");
    const firstField = panel.querySelector<HTMLElement>(
      "input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
    );
    const firstFocusable = autoFocusTarget ?? firstField ?? focusable[0] ?? panel;

    const timeoutId = window.setTimeout(() => {
      firstFocusable.focus();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    if (!panel) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusables.length) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 grid place-items-center p-4 sm:p-6",
        "pointer-events-auto",
      )}
    >
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-slate-950/46 backdrop-blur-[2px] dark:bg-black/60",
        )}
        aria-label="Fechar modal"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex w-full flex-col overflow-hidden rounded-[1.1rem] border border-border/75 bg-popover/98 text-popover-foreground shadow-[0_28px_58px_-30px_hsl(210_45%_18%_/_0.82)] sm:max-h-[84vh] dark:border-border/85 dark:bg-popover/94",
          maxWidthClassName,
        )}
      >
        {/* Header */}
        <div className="relative flex items-start justify-between gap-3 border-b border-border/60 bg-gradient-to-r from-primary/8 via-transparent to-accent/16 px-4 py-3 sm:px-5 dark:from-primary/12 dark:to-accent/12">
          <div className="flex items-center gap-3">
            {Icon ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/12">
                <Icon className="h-4 w-4 text-primary" />
              </div>
            ) : null}
            <div>
              <h2 id={titleId} className="font-display text-base font-bold text-foreground sm:text-lg">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/65 bg-background/65 text-muted-foreground transition-all duration-200 hover:border-destructive/35 hover:bg-destructive/10 hover:text-destructive dark:border-border/85 dark:bg-background/55"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="relative flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
          {children}
        </div>

        {/* Footer */}
        {footer ? (
          <div className="border-t border-border/60 bg-muted/22 px-4 py-2.5 sm:px-5 dark:bg-background/32">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
