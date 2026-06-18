import Image from "next/image";
import Link from "next/link";
import { FAQSection } from "@/components/public/faq-section";
import { HowItWorks } from "@/components/public/how-it-works";
import { CatalogItemGrid, FinalCta, HomePromotionsSection, HomeServicesSection } from "@/components/public/public-pages";
import { SectionHeader } from "@/components/public/section-header";
import { TrustBlock } from "@/components/public/trust-block";
import { ValueGrid } from "@/components/public/value-grid";
import { WhatsAppCta } from "@/components/public/whatsapp-cta";
import { Button } from "@/components/ui/button";
import { getPublicCatalogContent } from "@/lib/content/public-catalog";
import { buildPublicHomeContent, localizedPath, waMessage } from "@/lib/content/public-site";
import { type Locale } from "@/lib/i18n/config";
import { buildHomeMetadata } from "@/lib/seo/public-seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) { const { locale } = await params; return buildHomeMetadata(locale); }

export default async function LocaleHome({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const catalog = await getPublicCatalogContent(locale);
  const content = buildPublicHomeContent(locale, catalog);
  const { t } = content;
  const heroBannerSrc = locale === "en" ? "/brand/ac-travel-hero-banner-en.png" : "/brand/ac-travel-hero-banner-es.png";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-[var(--ac-orange)]/25 bg-[#f34d10] shadow-[0_18px_42px_rgba(238,89,42,0.16)]">
        <div className="relative aspect-[2/1] bg-[#f34d10]">
          <Image
            src={heroBannerSrc}
            alt="AC Travel banner"
            fill
            priority
            sizes="100vw"
            className="object-contain object-center"
          />
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/80 bg-[linear-gradient(135deg,var(--ac-light-bg),#fff7ed_52%,#edfaff)] px-6 py-10 shadow-sm sm:px-10 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start">
          <div className="min-w-0">
            <p className="text-sm font-extrabold uppercase tracking-[0.3em] text-[var(--ac-blue)]">{t.heroKicker}</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-[var(--ac-ink)] md:text-5xl lg:text-6xl">{t.homeTitle}</h1>
          </div>
          <div className="flex flex-col gap-4 lg:items-stretch lg:justify-start lg:pt-2">
            <WhatsAppCta
              message={waMessage(locale, t.finalCta.whatsappTopic)}
              label={t.primaryCta}
              locale={locale}
              pagePath={`/${locale}:hero`}
              className="w-full rounded-full px-6 py-6 text-base shadow-sm"
            />
            <Button asChild size="lg" className="w-full rounded-full px-6 py-6 text-base shadow-sm">
              <Link href={localizedPath(locale, "quote")}>{t.quoteCta}</Link>
            </Button>
          </div>
        </div>
        <p className="mt-8 max-w-5xl text-lg leading-8 text-zinc-700">{t.homeDescription}</p>
      </section>

      <ValueGrid
        title={t.sections.benefits[0]}
        description={t.sections.benefits[1]}
        items={t.benefits.map((item) => ({ title: item.title, text: item.text, eyebrow: item.eyebrow }))}
        columns="four"
      />

      <section className="space-y-6">
        <SectionHeader title={t.sections.destinations[0]} description={t.sections.destinations[1]} />
        <CatalogItemGrid locale={locale} items={content.destinations.filter((item) => item.featured)} section="destinations" />
      </section>
      <HowItWorks title={t.sections.process[0]} description={t.sections.process[1]} steps={[...t.process]} />
      <section className="space-y-6">
        <SectionHeader title={t.sections.services[0]} description={t.sections.services[1]} />
        <HomeServicesSection locale={locale} items={content.services} />
      </section>
      <section className="space-y-6">
        <SectionHeader title={t.sections.deals[0]} description={t.sections.deals[1]} />
        <HomePromotionsSection locale={locale} items={content.promotions} />
      </section>
      {content.packages.length ? (
        <section className="space-y-6">
          <SectionHeader title={locale === "es" ? "Paquetes" : "Packages"} description={locale === "es" ? "Paquetes publicados desde el catálogo live." : "Published packages from the live catalog."} />
          <CatalogItemGrid locale={locale} items={content.packages.slice(0, 3)} section="packages" />
        </section>
      ) : null}
      <TrustBlock
        title={t.sections.trust[0]}
        description={t.sections.trust[1]}
        items={[...t.trust]}
        eyebrow={locale === "es" ? "Confianza" : "Trust"}
        itemEyebrow={locale === "es" ? "Por qué elegirnos" : "Why choose us"}
      />
      <FAQSection locale={locale} title={t.sections.faq[0]} description={t.sections.faq[1]} items={[...t.faq]} />
      <FinalCta locale={locale} title={t.finalCta.title} text={t.finalCta.text} whatsappTopic={t.finalCta.whatsappTopic} quoteLabel={t.finalCta.quoteLabel} />
    </main>
  );
}
