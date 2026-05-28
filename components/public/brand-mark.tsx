import Link from "next/link";
import { type Locale } from "@/lib/i18n/config";

export function BrandMark({ locale }: Readonly<{ locale: Locale }>) {
  return (
    <Link href={`/${locale}`} className="group inline-flex items-center gap-3" aria-label="AC Travel home">
      <span className="grid size-11 place-items-center overflow-hidden rounded-2xl bg-white shadow-sm shadow-orange-900/10 transition-transform group-hover:scale-[1.03]">
        <img
          src="/brand/logo-ac-travel-horizontal.ai"
          alt="AC Travel"
          className="h-8 w-8 object-contain"
        />
      </span>
      <span className="leading-tight">
        <span className="block text-lg font-extrabold tracking-tight text-[var(--ac-ink)]">AC Travel</span>
        <span className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ac-blue)] sm:block">
          Mx
        </span>
      </span>
    </Link>
  );
}
