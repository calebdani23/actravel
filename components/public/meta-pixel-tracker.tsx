"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { captureMetaAttributionFromCurrentPage } from "@/lib/analytics/meta-attribution-client";
import { isMetaPixelEnabled, trackMetaPixelEvent } from "@/lib/analytics/meta-pixel";

export function MetaPixelTracker() {
  const pathname = usePathname();
  const hasTrackedInitialPageLoad = useRef(false);

  useEffect(() => {
    captureMetaAttributionFromCurrentPage(pathname);
  }, [pathname]);

  useEffect(() => {
    if (!isMetaPixelEnabled()) return;
    if (!hasTrackedInitialPageLoad.current) {
      hasTrackedInitialPageLoad.current = true;
      return;
    }

    trackMetaPixelEvent("PageView");
  }, [pathname]);

  return null;
}
