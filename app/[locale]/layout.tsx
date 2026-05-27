import { notFound } from "next/navigation";
import { LocaleHtmlLang } from "@/components/public/locale-html-lang";
import { PublicShell } from "@/components/public/public-shell";
import { isLocale, type Locale } from "@/lib/i18n/config";

export function generateStaticParams() {
  return [{ locale: "es" }, { locale: "en" }];
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return (
    <>
      <LocaleHtmlLang />
      <PublicShell locale={locale as Locale}>{children}</PublicShell>
    </>
  );
}
