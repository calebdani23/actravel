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

export type MetaPixelEventName = "PageView" | "Lead" | "Contact";

export function getMetaPixelId() {
  return process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
}

export function isMetaPixelEnabled() {
  return getMetaPixelId().length > 0;
}

export function trackMetaPixelEvent(eventName: MetaPixelEventName) {
  if (typeof window === "undefined") return;
  window.fbq?.("track", eventName);
}
