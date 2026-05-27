import { notFound } from "next/navigation";
import { type Locale } from "@/lib/i18n/config";

export function assertRouteLocale(locale: Locale, expected: Locale) {
  if (locale !== expected) notFound();
}
