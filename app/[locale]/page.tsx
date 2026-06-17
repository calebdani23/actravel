import Image from "next/image";
import Link from "next/link";
import { FAQSection } from "@/components/public/faq-section";
import { HowItWorks } from "@/components/public/how-it-works";
import { CatalogItemGrid, FinalCta, HomeServicesSection } from "@/components/public/public-pages";
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

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-[var(--ac-orange)]/15 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_24%,#effbff_100%)] shadow-sm">
        <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent)]" aria-hidden="true" />
        <div className="relative aspect-[16/7] sm:aspect-[18/7] lg:aspect-[21/6]">
          <Image
            src="/brand/ac-travel-hero-banner.svg"
            alt="AC Travel banner"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/80 bg-[linear-gradient(135deg,var(--ac-light-bg),#fff7ed_52%,#edfaff)] px-6 py-10 shadow-sm sm:px-10 md:py-12">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-start">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.3em] text-[var(--ac-blue)]">{t.heroKicker}</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-[var(--ac-ink)] md:text-5xl lg:text-6xl">{t.homeTitle}</h1>
          </div>
          <div className="lg:pt-3">
            <p className="max-w-2xl text-lg leading-8 text-zinc-700">{t.homeDescription}</p>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <WhatsAppCta message={waMessage(locale, t.finalCta.whatsappTopic)} label={t.primaryCta} locale={locale} pagePath={`/${locale}:hero`} className="rounded-full" />
          <Button asChild variant="outline" size="lg" className="rounded-full border-white bg-white/80">
            <Link href={localizedPath(locale, "quote")}>{t.quoteCta}</Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="rounded-full bg-white/40 sm:bg-transparent">
            <Link href={localizedPath(locale, "deals")}>{t.viewDeals}</Link>
          </Button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {t.heroSupport.map((item) => (
            <div key={item} className="rounded-[1.5rem] border border-white/80 bg-white/70 px-5 py-4 text-sm font-semibold text-zinc-700 shadow-sm shadow-orange-900/5 backdrop-blur">
              {item}
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-[1.5rem] border border-[var(--ac-blue)]/10 bg-white/70 px-5 py-4 text-sm text-zinc-700 shadow-sm shadow-slate-200/50">
          <span className="font-semibold text-[var(--ac-ink)]">{t.sections.trust[0]}:</span> {t.sections.trust[1]}
        </div>
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
      {content.packages.length ? (
        <section className="space-y-6">
          <SectionHeader title={locale === "es" ? "Paquetes" : "Packages"} description={locale === "es" ? "Paquetes publicados desde el catálogo live." : "Published packages from the live catalog."} />
          <CatalogItemGrid locale={locale} items={content.packages.slice(0, 3)} section="packages" />
        </section>
      ) : null}
      <section className="space-y-6">
        <SectionHeader title={t.sections.deals[0]} description={t.sections.deals[1]} />
        <CatalogItemGrid locale={locale} items={content.promotions.filter((item) => item.featured)} section="deals" />
      </section>
      <section className="space-y-6">
        <SectionHeader title={t.sections.services[0]} description={t.sections.services[1]} />
        <HomeServicesSection locale={locale} items={content.services} />
      </section>
      <HowItWorks title={t.sections.process[0]} description={t.sections.process[1]} steps={[...t.process]} />
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
