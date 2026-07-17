import { Footer } from "@/components/public/footer";
import { MetaPixelTracker } from "@/components/public/meta-pixel-tracker";
import { Navbar } from "@/components/public/navbar";
import { PublicRouteProvider } from "@/components/public/public-route-provider";
import { WhatsAppCta } from "@/components/public/whatsapp-cta";
import { getDictionary, type Locale } from "@/lib/i18n/config";

export async function PublicShell({ children, locale }: Readonly<{ children: React.ReactNode; locale: Locale }>) {
  const dictionary = getDictionary(locale);

  return (
    <PublicRouteProvider>
      <div className="min-h-screen bg-background text-foreground">
        <MetaPixelTracker />
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
    </PublicRouteProvider>
  );
}
