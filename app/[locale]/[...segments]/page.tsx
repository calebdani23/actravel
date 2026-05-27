import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";

export default async function PublicNotFoundPage({
  params,
}: {
  params: Promise<{ locale: string; segments: string[] }>;
}) {
  const { locale, segments } = await params;

  if (!isLocale(locale)) {
    notFound();
  }
  void segments;
  notFound();
}
