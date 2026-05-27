"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";

export function LocaleHtmlLang() {
  const pathname = usePathname();

  useEffect(() => {
    const locale = pathname.split("/")[1];

    if (isLocale(locale)) {
      document.documentElement.lang = locale;
    }
  }, [pathname]);

  return null;
}
