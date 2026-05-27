import Link from "next/link";
import { BrandMark } from "@/components/public/brand-mark";
import { CurrencySwitch } from "@/components/public/currency-switch";
import { LanguageSwitch } from "@/components/public/language-switch";
import { WhatsAppCta } from "@/components/public/whatsapp-cta";
import { getDictionary, type Locale } from "@/lib/i18n/config";

export function Navbar({ locale }: Readonly<{ locale: Locale }>) {
  const dictionary = getDictionary(locale);

  return (
    <header className="sticky top-0 z-20 border-b border-white/70 bg-white/85 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <BrandMark locale={locale} />
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <LanguageSwitch locale={locale} label={dictionary.controls.languageLabel} />
            </div>
            <div className="hidden md:block">
              <CurrencySwitch label={dictionary.controls.currencyLabel} />
            </div>
            <WhatsAppCta message={dictionary.home.whatsappMessage} label={dictionary.nav.whatsapp} locale={locale} pagePath={`/${locale}:nav`} className="hidden rounded-full md:inline-flex" />
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:justify-between md:overflow-visible md:pb-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Link href={`/${locale}`} className="whitespace-nowrap rounded-full px-3 py-2 text-[var(--ac-ink)] hover:bg-[var(--ac-orange-soft)]">
              {dictionary.nav.home}
            </Link>
            {dictionary.nav.items.map((item) => (
              <Link
                key={item.href}
                href={`/${locale}/${item.href}`}
                className="whitespace-nowrap rounded-full px-3 py-2 text-muted-foreground hover:bg-[var(--ac-orange-soft)] hover:text-[var(--ac-ink)]"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 sm:hidden">
            <LanguageSwitch locale={locale} label={dictionary.controls.languageLabel} />
            <CurrencySwitch label={dictionary.controls.currencyLabel} />
          </div>
        </div>
      </nav>
    </header>
  );
}
