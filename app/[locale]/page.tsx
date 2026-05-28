import Link from "next/link";
import { FAQSection } from "@/components/public/faq-section";
import { HowItWorks } from "@/components/public/how-it-works";
import { FinalCta, ItemGrid } from "@/components/public/public-pages";
import { SectionHeader } from "@/components/public/section-header";
import { TrustBlock } from "@/components/public/trust-block";
import { ValueGrid } from "@/components/public/value-grid";
import { WhatsAppCta } from "@/components/public/whatsapp-cta";
import { Button } from "@/components/ui/button";
import { getPublicCatalogContent } from "@/lib/content/public-catalog";
import { buildPublicHomeContent, localizedPath, waMessage } from "@/lib/content/public-site";
import { type Locale } from "@/lib/i18n/config";
import { buildHomeMetadata } from "@/lib/seo/public-seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) { const { locale } = await params; return buildHomeMetadata(locale); }

function homeItemText(item: { description?: Record<Locale, string>; summary?: Record<Locale, string>; text?: Record<Locale, string> }, locale: Locale) {
  return item.description?.[locale] ?? item.summary?.[locale] ?? item.text?.[locale] ?? "";
}

export default async function LocaleHome({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const catalog = await getPublicCatalogContent(locale).catch(() => null);
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
          <div className="rounded-[2rem] border border-white/80 bg-white/70 p-4 shadow-xl shadow-orange-900/5 backdrop-blur">
            <div className="aspect-[4/3] rounded-[1.5rem] bg-[linear-gradient(135deg,rgba(27,139,173,0.22),rgba(238,89,42,0.18)),url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 600 450%22%3E%3Cpath fill=%22%23ffffff%22 fill-opacity=%220.55%22 d=%22M0 338c95-43 167-44 264-7s168 41 336-28v147H0z%22/%3E%3Ccircle cx=%22460%22 cy=%22102%22 r=%2254%22 fill=%22%23ee592a%22 fill-opacity=%220.38%22/%3E%3Cpath fill=%22%231b8bad%22 fill-opacity=%220.28%22 d=%22M0 288c95-33 156-22 243 5 108 34 195 33 357-48v75c-124 60-237 73-356 36-91-29-165-34-244 5z%22/%3E%3C/svg%3E')] bg-cover bg-center" aria-label="Beach inspired travel visual" />
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
        <ItemGrid locale={locale} items={content.destinations.filter((item) => item.featured)} section="destinations" />
      </section>
      {content.packages.length ? (
        <ValueGrid
          title={locale === "es" ? "Paquetes" : "Packages"}
          description={locale === "es" ? "Paquetes publicados desde el catálogo live." : "Published packages from the live catalog."}
          items={content.packages.slice(0, 3).map((item) => ({ title: item.title[locale], text: homeItemText(item, locale), eyebrow: item.eyebrow?.[locale] }))}
        />
      ) : null}
      <section className="space-y-6">
        <SectionHeader title={t.sections.deals[0]} description={t.sections.deals[1]} />
        <ItemGrid locale={locale} items={content.promotions.filter((item) => item.featured)} section="deals" />
      </section>
      <ValueGrid items={content.services.slice(0, 3).map((service) => ({ title: service.title[locale], text: homeItemText(service, locale), eyebrow: service.eyebrow?.[locale] }))} />
      <HowItWorks title={t.sections.process[0]} description={t.sections.process[1]} steps={[...t.process]} />
      <TrustBlock title={t.sections.trust[0]} description={t.sections.trust[1]} items={[...t.trust]} />
      <FAQSection locale={locale} title={t.sections.faq[0]} description={t.sections.faq[1]} items={[...t.faq]} />
      <FinalCta locale={locale} title={t.finalCta.title} text={t.finalCta.text} whatsappTopic={t.finalCta.whatsappTopic} quoteLabel={t.finalCta.quoteLabel} />
    </main>
  );
}
