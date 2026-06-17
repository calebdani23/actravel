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
      <section className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-[linear-gradient(135deg,var(--ac-light-bg),#fff7ed_46%,#e7f7fb)] px-6 py-14 shadow-sm sm:px-10 md:py-20">
        <div className="absolute right-[-5rem] top-[-5rem] size-56 rounded-full bg-[var(--ac-orange)]/10 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.3em] text-[var(--ac-blue)]">{t.heroKicker}</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-[var(--ac-ink)] md:text-6xl">{t.homeTitle}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-700">{t.homeDescription}</p>
            <ul className="mt-6 grid gap-2 text-sm font-semibold text-zinc-700 sm:grid-cols-3">
              {t.heroSupport.map((item) => <li key={item} className="rounded-full bg-white/70 px-4 py-2">{item}</li>)}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <WhatsAppCta message={waMessage(locale, t.finalCta.whatsappTopic)} label={t.primaryCta} locale={locale} pagePath={`/${locale}:hero`} className="rounded-full" />
              <Button asChild variant="outline" size="lg" className="rounded-full border-white bg-white/75">
                <Link href={localizedPath(locale, "quote")}>{t.quoteCta}</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="rounded-full">
                <Link href={localizedPath(locale, "deals")}>{t.viewDeals}</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/80 bg-white/70 p-4 shadow-xl shadow-orange-900/5 backdrop-blur sm:p-5">
            <div className="relative overflow-hidden rounded-[1.5rem] border border-white/70 bg-[linear-gradient(135deg,rgba(27,139,173,0.16),rgba(238,89,42,0.08)_55%,rgba(255,255,255,0.92))] p-4 sm:p-6">
              <div className="absolute inset-x-10 bottom-2 h-16 rounded-full bg-[var(--ac-orange)]/10 blur-3xl" aria-hidden="true" />
              <div className="relative aspect-[16/9] sm:aspect-[21/10]">
                <Image
                  src="/brand/ac-travel-hero-banner.svg"
                  alt="AC Travel banner"
                  fill
                  priority
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-contain object-center drop-shadow-[0_20px_40px_rgba(15,23,42,0.16)]"
                />
              </div>
            </div>
          </div>
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
