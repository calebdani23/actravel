"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { X } from "lucide-react";
import { captureDialogLifecycleState, resolveDialogKeyAction, restoreDialogLifecycleState, type DialogFocusableTarget } from "@/lib/admin/operation-dialog";
import { cn } from "@/lib/utils/cn";

type OperationDialogProps = {
  triggerLabel: string;
  title: string;
  description?: string;
  children: ReactNode;
  triggerClassName?: string;
};

export function OperationDialog({ triggerLabel, title, description, children, triggerClassName }: Readonly<OperationDialogProps>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedElementRef = useRef<DialogFocusableTarget>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    const lifecycleState = captureDialogLifecycleState({
      activeElement: document.activeElement instanceof HTMLElement ? document.activeElement : null,
      triggerElement: triggerRef.current,
      originalOverflow: document.body.style.overflow,
    });

    lastFocusedElementRef.current = lifecycleState.lastFocusedElement;
    document.body.style.overflow = "hidden";

    window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      const restoredState = restoreDialogLifecycleState({
        originalOverflow: lifecycleState.originalOverflow,
        lastFocusedElement: lastFocusedElementRef.current,
      });
      document.body.style.overflow = restoredState.bodyOverflow;
    };
  }, [open]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    const action = resolveDialogKeyAction({
      key: event.key,
      shiftKey: event.shiftKey,
      focusableCount: focusable?.length ?? 0,
      activeIndex: focusable ? Array.from(focusable).indexOf(document.activeElement as HTMLElement) : -1,
    });

    if (!action.preventDefault && !action.close) return;

    event.preventDefault();

    if (action.close) {
      setOpen(false);
      return;
    }

    if (!focusable?.length) return;

    if (action.focusTarget === "last") {
      focusable[focusable.length - 1]?.focus();
    } else if (action.focusTarget === "first") {
      focusable[0]?.focus();
    }
  };

  return (
    <>
      <button
        className={cn(
          "inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--ac-blue)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--admin-ring)] disabled:pointer-events-none disabled:opacity-50",
          triggerClassName,
        )}
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        {triggerLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" onKeyDown={handleKeyDown}>
          <button
            aria-label="Cerrar formulario"
            className="absolute inset-0 bg-[#211816]/45 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
            type="button"
          />

          <div
            aria-describedby={description ? descriptionId : undefined}
            aria-labelledby={titleId}
            aria-modal="true"
            className={cn(
              "relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] shadow-[0_18px_42px_rgba(33,24,22,0.18)]",
              "rounded-t-[var(--admin-radius-card)] sm:max-w-3xl sm:rounded-[var(--admin-radius-card)]",
            )}
            ref={dialogRef}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--admin-border-subtle)] px-5 py-4 sm:px-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-[color:var(--admin-foreground)]" id={titleId}>{title}</h2>
                {description ? <p className="text-sm text-[color:var(--admin-muted-foreground)]" id={descriptionId}>{description}</p> : null}
              </div>
              <button
                aria-label="Cerrar formulario"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-transparent text-[color:var(--admin-muted-foreground)] transition hover:border-[color:var(--admin-border)] hover:bg-[color:var(--admin-surface-muted)] hover:text-[color:var(--admin-foreground)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--admin-ring)]"
                onClick={() => setOpen(false)}
                ref={closeButtonRef}
                type="button"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
