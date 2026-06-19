import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CatalogCardSlider } from "@/components/public/catalog-card-slider";
import { WhatsAppCta } from "@/components/public/whatsapp-cta";
import { ItemCard } from "@/components/public/item-card";
import { LegalNotice } from "@/components/public/legal-notice";
import { QuoteForm, type QuoteFormInitialContext } from "@/components/public/quote-form";
import { SectionHeader } from "@/components/public/section-header";
import { Button } from "@/components/ui/button";
import { type Locale } from "@/lib/i18n/config";
import {
  getPublicSiteContent,
  getRelatedPromotionItems,
  localizedPath,
  priceLabel,
  type LegalKey,
  type PublicItem,
  waMessage,
} from "@/lib/content/public-site";
import { getPublicCatalogContent, getPublicCatalogItem } from "@/lib/content/public-catalog";

function PageShell({ children }: Readonly<{ children: ReactNode }>) {
  return <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">{children}</main>;
}

export async function ListingPage({ locale, kind }: Readonly<{ locale: Locale; kind: "services" | "packages" | "deals" | "destinations" }>) {
  const staticContent = getPublicSiteContent(locale);
  const page = staticContent.t.listingPages[kind];
  const catalog = await getPublicCatalogContent(locale);

  const serviceItems = catalog?.services ?? [];
  const packageItems = catalog?.packages ?? [];
  const destinationItems = catalog?.destinations ?? [];
  const promotionItems = catalog?.promotions ?? [];
  return (
    <PageShell>
      <SectionHeader eyebrow={page.eyebrow} title={page.title} description={page.description} />
      {kind === "services" ? <CatalogItemGrid locale={locale} items={serviceItems} section="services" /> : null}
      {kind === "packages" ? <CatalogItemGrid locale={locale} items={packageItems} section="packages" /> : null}
      {kind === "deals" ? <CatalogItemGrid locale={locale} items={promotionItems} section="deals" /> : null}
      {kind === "destinations" ? <CatalogItemGrid locale={locale} items={destinationItems} section="destinations" /> : null}
      <p className="rounded-3xl bg-[var(--ac-light-bg)] p-5 text-sm leading-6 text-muted-foreground">{page.note}</p>
      <FinalCta locale={locale} title={page.ctaTitle} text={page.ctaText} whatsappTopic={page.ctaTopic} />
    </PageShell>
  );
}

function CatalogEmptyState({ locale }: Readonly<{ locale: Locale }>) {
  return <p className="rounded-3xl border bg-white p-6 text-sm text-muted-foreground">{locale === "es" ? "No hay contenido publicado todavía." : "No published content yet."}</p>;
}

export function CatalogItemGrid({ locale, items, section }: Readonly<{ locale: Locale; items: PublicItem[]; section: "services" | "packages" | "deals" | "destinations" }>) {
  if (!items.length) {
    return <CatalogEmptyState locale={locale} />;
  }

  return (
    <div className="grid gap-5 md:grid-cols-3">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          title={item.title[locale]}
          summary={item.summary[locale]}
          eyebrow={item.eyebrow?.[locale]}
          price={priceLabel(locale, item.price)}
          highlights={item.highlights[locale]}
          note={item.detailNote?.[locale] ?? undefined}
          href={localizedPath(locale, section, item.slug[locale])}
          cta={locale === "es" ? "Ver detalle" : "View detail"}
          imageUrl={item.media?.thumbnailImageUrl ?? item.media?.heroImageUrl ?? undefined}
        />
      ))}
    </div>
  );
}

export async function DetailPage({ locale, slug, kind }: Readonly<{ locale: Locale; slug: string; kind: "deal" | "destination" | "package" | "service" }>) {
  const catalogKind = kind === "deal" ? "promotions" : kind === "package" ? "packages" : kind === "service" ? "services" : "destinations";
  const [catalog, item] = await Promise.all([getPublicCatalogContent(locale), getPublicCatalogItem(locale, catalogKind, slug)]);
  if (!item) notFound();
  const relatedPromotions = getRelatedPromotionItems(catalog, kind === "deal" ? "promotion" : kind, item);
  const back = kind === "deal" ? "deals" : kind === "package" ? "packages" : kind === "service" ? "services" : "destinations";
  const sidebarTitle = kind === "package"
    ? (locale === "es" ? "Qué incluye / cómo se adapta" : "What it includes / how it adapts")
    : kind === "service"
      ? (locale === "es" ? "Qué resolvemos / cómo te ayudamos" : "What we solve / how we help")
      : locale === "es"
        ? "Incluye / ideas"
        : "Includes / ideas";
  const highlights = item.highlights[locale];
  const detailSections = item.detailSections?.[locale] ?? null;
  return (
    <PageShell>
      <section className="grid gap-8 rounded-[2rem] border bg-white p-6 shadow-sm lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
        <div>
          {item.media?.heroImageUrl ?? item.media?.thumbnailImageUrl ? <img alt="" className="mb-5 h-72 w-full rounded-[2rem] object-cover" loading="lazy" src={item.media?.heroImageUrl ?? item.media?.thumbnailImageUrl ?? ""} /> : null}
          <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-[var(--ac-blue)]">{item.eyebrow?.[locale] ?? "AC Travel"}</p>
          <h1 className="mt-3 text-4xl font-black text-[var(--ac-ink)] md:text-5xl">{item.title[locale]}</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">{item.description[locale]}</p>
          {item.bestFor ? <p className="mt-4 rounded-3xl bg-[var(--ac-light-bg)] p-4 text-sm font-semibold leading-6 text-[var(--ac-ink)]">{item.bestFor[locale]}</p> : null}
          <p className="mt-5 text-xl font-extrabold text-[var(--ac-red)]">{priceLabel(locale, item.price)}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
             <WhatsAppCta message={waMessage(locale, item.title[locale])} label={item.detailCta?.[locale] ?? (locale === "es" ? "Consultar por WhatsApp" : "Ask on WhatsApp")} locale={locale} pagePath={`/${locale}/${back}/${item.slug[locale]}:detail`} className="rounded-full" />
            <Button asChild variant="outline" className="rounded-full">
              <Link href={localizedPath(locale, "quote")}>{locale === "es" ? "Enviar datos" : "Send details"}</Link>
            </Button>
            <Button asChild variant="ghost" className="rounded-full">
              <Link href={localizedPath(locale, back)}>{locale === "es" ? "Volver" : "Back"}</Link>
            </Button>
          </div>
        </div>
        <div className="rounded-[2rem] bg-[var(--ac-light-bg)] p-6">
          <h2 className="font-black text-[var(--ac-ink)]">{sidebarTitle}</h2>
          {detailSections && detailSections.length ? (
            <div className="mt-4 grid gap-4 text-sm leading-6 text-zinc-700">
              {detailSections.map((section) => (
                <div key={section.title}>
                  {section.title ? <h3 className="font-black text-[var(--ac-ink)]">{section.title}</h3> : null}
                  <ul className="mt-2 grid gap-2">
                    {section.items.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          ) : highlights.length ? (
            <ul className="mt-4 grid gap-3 text-sm leading-6 text-zinc-700">
              {highlights.map((highlight) => <li key={highlight}>• {highlight}</li>)}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-6 text-zinc-700">{kind === "package" || kind === "service" ? item.summary[locale] : item.description[locale]}</p>
          )}
          {item.planningNotes ? (
            <div className="mt-6 rounded-3xl bg-white p-5">
              <h3 className="font-black text-[var(--ac-ink)]">{locale === "es" ? "Para planear mejor" : "To plan better"}</h3>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-zinc-700">
                {item.planningNotes[locale].map((note) => <li key={note}>• {note}</li>)}
              </ul>
            </div>
          ) : null}
          {item.detailNote?.[locale] ? <p className="mt-6 text-xs leading-5 text-muted-foreground">{item.detailNote[locale]}</p> : null}
        </div>
      </section>
      {relatedPromotions.length ? (
        <section className="space-y-4">
          <SectionHeader
            eyebrow={locale === "es" ? "Promociones relacionadas" : "Related promotions"}
            title={locale === "es" ? "Promociones publicadas para seguir explorando" : "Published promotions to keep exploring"}
            description={locale === "es" ? "Mostramos solo promociones publicadas conectadas a este detalle." : "We only show published promotions connected to this detail."}
          />
          <CatalogItemGrid locale={locale} items={relatedPromotions} section="deals" />
        </section>
      ) : null}
    </PageShell>
  );
}

export function HomeServicesSection({ locale, items }: Readonly<{ locale: Locale; items: PublicItem[] }>) {
  if (!items.length) {
    return <CatalogEmptyState locale={locale} />;
  }

  return (
    <CatalogCardSlider
      locale={locale}
      items={items}
      section="services"
      cta={locale === "es" ? "Ver detalle" : "View detail"}
      previousLabel={locale === "es" ? "Ver servicios anteriores" : "View previous services"}
      nextLabel={locale === "es" ? "Ver más servicios" : "View more services"}
    />
  );
}

export function HomePromotionsSection({ locale, items }: Readonly<{ locale: Locale; items: PublicItem[] }>) {
  if (!items.length) {
    return <CatalogEmptyState locale={locale} />;
  }

  if (items.length <= 3) {
    return <CatalogItemGrid locale={locale} items={items} section="deals" />;
  }

  return (
    <CatalogCardSlider
      locale={locale}
      items={items}
      section="deals"
      cta={locale === "es" ? "Ver detalle" : "View detail"}
      previousLabel={locale === "es" ? "Ver promociones anteriores" : "View previous promotions"}
      nextLabel={locale === "es" ? "Ver más promociones" : "View more promotions"}
    />
  );
}

export function QuotePage({ locale, initialContext }: Readonly<{ locale: Locale; initialContext?: QuoteFormInitialContext }>) {
  return <PageShell><QuoteForm locale={locale} initialContext={initialContext} /></PageShell>;
}

export function InfoPage({ locale, kind }: Readonly<{ locale: Locale; kind: "about" | "contact" }>) {
  const { t } = getPublicSiteContent(locale);
  const title = kind === "about" ? t.aboutTitle : t.contactTitle;
  const text = kind === "about" ? t.aboutText : t.contactText;
  return <PageShell><SectionHeader eyebrow="AC Travel" title={title} description={text} /><FinalCta locale={locale} /></PageShell>;
}

export function LegalPage({ locale, legalKey }: Readonly<{ locale: Locale; legalKey: LegalKey }>) {
  const { t } = getPublicSiteContent(locale);
  const [title, text] = t.legal[legalKey];
  return <PageShell><SectionHeader eyebrow="AC Travel" title={title} description={text} /><LegalNotice notice={t.legalProvisional} /></PageShell>;
}

export function FinalCta({ locale, title, text, whatsappTopic, quoteLabel }: Readonly<{ locale: Locale; title?: string; text?: string; whatsappTopic?: string; quoteLabel?: string }>) {
  const { t } = getPublicSiteContent(locale);
  const finalTitle = title ?? t.finalCta.title;
  const finalText = text ?? t.finalCta.text;
  const topic = whatsappTopic ?? t.finalCta.whatsappTopic;
  return (
    <section className="rounded-[2rem] border bg-white p-6 shadow-sm md:flex md:items-center md:justify-between md:gap-8 md:p-8">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[var(--ac-red)]">WhatsApp first</p>
        <h2 className="mt-2 text-2xl font-black text-[var(--ac-ink)]">{finalTitle}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{finalText}</p>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row md:mt-0">
        <WhatsAppCta message={waMessage(locale, topic)} label={t.primaryCta} locale={locale} pagePath={`/${locale}:final-cta`} className="rounded-full" />
        <Button asChild variant="outline" className="rounded-full">
          <Link href={localizedPath(locale, "quote")}>{quoteLabel ?? t.quoteCta}</Link>
        </Button>
      </div>
    </section>
  );
}
