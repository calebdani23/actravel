"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePublicRouteAlternates } from "@/components/public/public-route-provider";
import { type Locale } from "@/lib/i18n/config";
import { getLocalizedPath } from "@/lib/i18n/public-routes";
import { cn } from "@/lib/utils/cn";

export function LanguageSwitch({ locale, label }: Readonly<{ locale: Locale; label: string }>) {
  const pathname = usePathname();
  const { alternatePaths } = usePublicRouteAlternates();

  return (
    <div className="flex items-center gap-1 rounded-full border border-white/70 bg-white/80 p-1 text-xs font-bold shadow-sm" aria-label={label}>
      {(["es", "en"] as const).map((option) => (
        <Link
          key={option}
          href={getLocalizedPath(pathname, option, alternatePaths?.[option])}
          className={cn(
            "rounded-full px-2.5 py-1 uppercase text-muted-foreground hover:text-[var(--ac-ink)]",
            option === locale && "bg-[var(--ac-blue)] text-white hover:text-white",
          )}
          aria-current={option === locale ? "true" : undefined}
        >
          {option}
        </Link>
      ))}
    </div>
  );
}
