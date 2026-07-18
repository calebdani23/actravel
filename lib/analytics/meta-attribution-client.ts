"use client";

import { buildMetaAttribution, META_ATTRIBUTION_STORAGE_KEY, parseMetaAttributionSnapshot, type MetaAttribution } from "@/lib/analytics/meta-attribution";

function safeLocalStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function readStoredMetaAttribution() {
  const storage = safeLocalStorage();
  const snapshot = storage?.getItem(META_ATTRIBUTION_STORAGE_KEY);
  return parseMetaAttributionSnapshot(snapshot);
}

export function writeStoredMetaAttribution(attribution: MetaAttribution) {
  const storage = safeLocalStorage();
  storage?.setItem(META_ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
}

export function captureMetaAttributionFromCurrentPage(pathname: string) {
  if (typeof window === "undefined") return undefined;

  const next = buildMetaAttribution({
    pathname,
    href: window.location.href,
    referrer: document.referrer,
    searchParams: new URLSearchParams(window.location.search),
    cookie: document.cookie,
    existing: readStoredMetaAttribution(),
  });

  if (next) {
    writeStoredMetaAttribution(next);
  }

  return next;
}
