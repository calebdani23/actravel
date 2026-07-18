declare global {
  interface Window {
    fbq?: MetaPixelFunction;
    _fbq?: MetaPixelFunction;
  }
}

type MetaPixelFunction = {
  (...args: [command: string, eventName: string, ...rest: unknown[]]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  push?: (...args: unknown[]) => number;
  version?: string;
};

export type MetaPixelEventName = "PageView" | "Lead" | "Contact" | "ViewContent" | "InitiateCheckout";

export type MetaPixelEventOptions = {
  eventId?: string;
  payload?: Record<string, unknown>;
};

export function getMetaPixelId() {
  return process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
}

export function isMetaPixelEnabled() {
  return getMetaPixelId().length > 0;
}

export function trackMetaPixelEvent(eventName: MetaPixelEventName, options: MetaPixelEventOptions = {}) {
  if (typeof window === "undefined") return;
  const payload = options.payload ?? {};
  const meta = options.eventId ? { eventID: options.eventId } : undefined;
  window.fbq?.("track", eventName, payload, meta);
}
