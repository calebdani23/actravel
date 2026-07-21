export type PendingSafeCancelState =
  | { kind: "link"; href: string }
  | { kind: "disabled"; ariaDisabled: true };

export function getPendingSafeCancelState(href: string, pending: boolean): PendingSafeCancelState {
  if (pending) return { kind: "disabled", ariaDisabled: true };
  return { kind: "link", href };
}
