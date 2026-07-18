"use client";

import { useEffect, useRef } from "react";
import { isMetaPixelEnabled, trackMetaPixelEvent, type MetaPixelEventName } from "@/lib/analytics/meta-pixel";

type Props = Readonly<{
  eventName: MetaPixelEventName;
  payload?: Record<string, unknown>;
}>;

export function MetaPixelEventTracker({ eventName, payload }: Props) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current || !isMetaPixelEnabled()) return;
    tracked.current = true;
    trackMetaPixelEvent(eventName, { payload });
  }, [eventName, payload]);

  return null;
}
