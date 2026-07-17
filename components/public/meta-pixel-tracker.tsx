"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isMetaPixelEnabled, trackMetaPixelEvent } from "@/lib/analytics/meta-pixel";

export function MetaPixelTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isMetaPixelEnabled()) return;
    trackMetaPixelEvent("PageView");
  }, [pathname]);

  return null;
}
