import { Footer } from "@/components/public/footer";
import { Navbar } from "@/components/public/navbar";
import { WhatsAppCta } from "@/components/public/whatsapp-cta";
import { getDictionary, type Locale } from "@/lib/i18n/config";

export function PublicShell({ children, locale }: Readonly<{ children: React.ReactNode; locale: Locale }>) {
  const dictionary = getDictionary(locale);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar locale={locale} />
      {children}
      <Footer locale={locale} />
      <WhatsAppCta
        message={dictionary.home.whatsappMessage}
        label={dictionary.whatsapp.floatingLabel}
        shortLabel={dictionary.whatsapp.floatingShort}
        locale={locale}
        pagePath={`/${locale}:floating`}
        floating
      />
    </div>
  );
}
