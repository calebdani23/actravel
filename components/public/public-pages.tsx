import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { WhatsAppCta } from "@/components/public/whatsapp-cta";
import { ItemCard } from "@/components/public/item-card";
import { LegalNotice } from "@/components/public/legal-notice";
import { QuoteForm, type QuoteFormInitialContext } from "@/components/public/quote-form";
import { SectionHeader } from "@/components/public/section-header";
import { ValueGrid } from "@/components/public/value-grid";
import { Button } from "@/components/ui/button";
import { type Locale } from "@/lib/i18n/config";
import {
  getPublicSiteContent,
  localizedPath,
  priceLabel,
  type LegalKey,
  type PublicItem,
  waMessage,
} from "@/lib/content/public-site";
import { getLivePublicCatalogContent } from "@/lib/content/public-catalog";

function PageShell({ children }: Readonly<{ children: ReactNode }>) {
  return <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">{children}</main>;
}

export async function ListingPage({ locale, kind }: Readonly<{ locale: Locale; kind: "services" | "packages" | "deals" | "destinations" }>) {
  const staticContent = getPublicSiteContent(locale);
  const page = staticContent.t.listingPages[kind];
  const catalog = await getLivePublicCatalogContent(locale).catch(() => null);
  const serviceItems = catalog?.services ?? [];
  const packageItems = catalog?.packages ?? [];
  const destinationItems = catalog?.destinations ?? [];
  const promotionItems = catalog?.promotions ?? [];
  return (
    <PageShell>
      <SectionHeader eyebrow={page.eyebrow} title={page.title} description={page.description} />
      {kind === "services" ? <CatalogEmptyState locale={locale} items={serviceItems} /> : null}
      {kind === "packages" ? <CatalogEmptyState locale={locale} items={packageItems} /> : null}
      {kind === "deals" ? <ItemGrid locale={locale} items={promotionItems} section="deals" /> : null}
      {kind === "destinations" ? <ItemGrid locale={locale} items={destinationItems} section="destinations" /> : null}
      <p className="rounded-3xl bg-[var(--ac-light-bg)] p-5 text-sm leading-6 text-muted-foreground">{page.note}</p>
      <FinalCta locale={locale} title={page.ctaTitle} text={page.ctaText} whatsappTopic={page.ctaTopic} />
    </PageShell>
  );
}

function CatalogEmptyState({ locale, items }: Readonly<{ locale: Locale; items: Array<{ title: Record<Locale, string>; text?: Record<Locale, string>; description?: Record<Locale, string>; eyebrow?: Record<Locale, string> }> }>) {
  if (!items.length) {
    return <p className="rounded-3xl border bg-white p-6 text-sm text-muted-foreground">{locale === "es" ? "No hay contenido publicado todavía." : "No published content yet."}</p>;
  }

  return <ValueGrid items={items.map((item) => ({ title: item.title[locale], text: item.description?.[locale] ?? item.text?.[locale] ?? "", eyebrow: item.eyebrow?.[locale] }))} />;
}

export function ItemGrid({ locale, items, section }: Readonly<{ locale: Locale; items: PublicItem[]; section: "deals" | "destinations" }>) {
  if (!items.length) {
    return <p className="rounded-3xl border bg-white p-6 text-sm text-muted-foreground">{locale === "es" ? "No hay contenido publicado todavía." : "No published content yet."}</p>;
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
          imageUrl={item.media?.heroImageUrl ?? item.media?.thumbnailImageUrl ?? undefined}
        />
      ))}
    </div>
  );
}

export async function DetailPage({ locale, slug, kind }: Readonly<{ locale: Locale; slug: string; kind: "deal" | "destination" }>) {
  const catalog = await getLivePublicCatalogContent(locale).catch(() => null);
  const item = catalog ? (kind === "deal" ? catalog.promotions : catalog.destinations).find((entry) => entry.slug[locale] === slug) : null;
  if (!item) notFound();
  const back = kind === "deal" ? "deals" : "destinations";
  return (
    <PageShell>
      <section className="grid gap-8 rounded-[2rem] border bg-white p-6 shadow-sm lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
        <div>
          {item.media?.heroImageUrl ? <img alt="" className="mb-5 h-72 w-full rounded-[2rem] object-cover" loading="lazy" src={item.media.heroImageUrl} /> : null}
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
          <h2 className="font-black text-[var(--ac-ink)]">{locale === "es" ? "Incluye / ideas" : "Includes / ideas"}</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-zinc-700">
            {item.highlights[locale].map((highlight) => <li key={highlight}>• {highlight}</li>)}
          </ul>
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
    </PageShell>
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
