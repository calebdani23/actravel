import Link from "next/link";
import { BrandMark } from "@/components/public/brand-mark";
import { WhatsAppCta } from "@/components/public/whatsapp-cta";
import { getDictionary, type Locale } from "@/lib/i18n/config";

export function Footer({ locale }: Readonly<{ locale: Locale }>) {
  const dictionary = getDictionary(locale);

  return (
    <footer className="border-t border-white/70 bg-[var(--ac-ink)] text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr] lg:px-8">
        <div className="space-y-4">
          <div className="inline-flex rounded-3xl bg-white p-2">
            <BrandMark locale={locale} />
          </div>
          <p className="max-w-md text-sm text-white/72">{dictionary.footer.description}</p>
          <p className="text-lg font-bold text-white">{dictionary.footer.tagline}</p>
        </div>
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-[0.18em] text-white/60">{dictionary.footer.sections}</h2>
          <div className="mt-4 grid gap-2 text-sm text-white/75">
            {dictionary.nav.items.slice(0, 5).map((item) => (
              <Link key={item.href} href={`/${locale}/${item.href}`} className="hover:text-white">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.18em] text-white/60">{dictionary.footer.contact}</h2>
          <p className="text-sm text-white/75">WhatsApp: {dictionary.footer.whatsapp}</p>
          <WhatsAppCta message={dictionary.home.whatsappMessage} label={dictionary.footer.cta} locale={locale} pagePath={`/${locale}:footer`} className="rounded-full" />
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} AC Travel. {dictionary.footer.rights}
      </div>
    </footer>
  );
}
