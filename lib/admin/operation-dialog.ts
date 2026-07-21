export type DialogFocusableTarget = {
  focus: () => void;
  isConnected?: boolean;
} | null;

export type DialogLifecycleState = {
  originalOverflow: string;
  lastFocusedElement: DialogFocusableTarget;
};

export function captureDialogLifecycleState({
  activeElement,
  triggerElement,
  originalOverflow,
}: {
  activeElement: DialogFocusableTarget;
  triggerElement: DialogFocusableTarget;
  originalOverflow: string;
}): DialogLifecycleState {
  return {
    originalOverflow,
    lastFocusedElement: activeElement ?? triggerElement,
  };
}

export function restoreDialogLifecycleState(state: DialogLifecycleState) {
  if (state.lastFocusedElement?.isConnected) {
    state.lastFocusedElement.focus();
    return { restoredFocus: true, bodyOverflow: state.originalOverflow };
  }

  return { restoredFocus: false, bodyOverflow: state.originalOverflow };
}

export function resolveDialogKeyAction({
  key,
  shiftKey,
  focusableCount,
  activeIndex,
}: {
  key: string;
  shiftKey: boolean;
  focusableCount: number;
  activeIndex: number;
}) {
  if (key === "Escape") {
    return { close: true, preventDefault: true, focusTarget: null as "first" | "last" | null };
  }

  if (key !== "Tab") {
    return { close: false, preventDefault: false, focusTarget: null as "first" | "last" | null };
  }

  if (focusableCount <= 0) {
    return { close: false, preventDefault: true, focusTarget: null as "first" | "last" | null };
  }

  if (shiftKey && activeIndex <= 0) {
    return { close: false, preventDefault: true, focusTarget: "last" as const };
  }

  if (!shiftKey && activeIndex === focusableCount - 1) {
    return { close: false, preventDefault: true, focusTarget: "first" as const };
  }

  return { close: false, preventDefault: false, focusTarget: null as "first" | "last" | null };
}
