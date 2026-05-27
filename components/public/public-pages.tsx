import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { WhatsAppCta } from "@/components/public/whatsapp-cta";
import { ItemCard } from "@/components/public/item-card";
import { LegalNotice } from "@/components/public/legal-notice";
import { QuoteForm } from "@/components/public/quote-form";
import { SectionHeader } from "@/components/public/section-header";
import { Button } from "@/components/ui/button";
import { type Locale } from "@/lib/i18n/config";
import {
  findDestination,
  findPromotion,
  getPublicSiteContent,
  localizedPath,
  priceLabel,
  type LegalKey,
  type PublicItem,
  waMessage,
} from "@/lib/content/public-site";

function PageShell({ children }: Readonly<{ children: ReactNode }>) {
  return <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">{children}</main>;
}

export function ListingPage({ locale, kind }: Readonly<{ locale: Locale; kind: "services" | "packages" | "deals" | "destinations" }>) {
  const content = getPublicSiteContent(locale);
  const title = {
    services: content.t.servicesTitle,
    packages: content.t.packagesTitle,
    deals: content.t.dealsTitle,
    destinations: content.t.destinationsTitle,
  }[kind];
  return (
    <PageShell>
      <SectionHeader eyebrow="AC Travel" title={title} description={content.t.sections[kind === "deals" ? "deals" : kind === "destinations" ? "destinations" : "services"][1]} />
      {kind === "services" ? <SimpleGrid items={content.services.map((item) => ({ title: item.title[locale], text: item.text[locale] }))} /> : null}
      {kind === "packages" ? <SimpleGrid items={content.packages.map((item) => ({ title: item.title[locale], text: item.text[locale] }))} /> : null}
      {kind === "deals" ? <ItemGrid locale={locale} items={content.promotions} section="deals" /> : null}
      {kind === "destinations" ? <ItemGrid locale={locale} items={content.destinations} section="destinations" /> : null}
      <FinalCta locale={locale} />
    </PageShell>
  );
}

function SimpleGrid({ items }: Readonly<{ items: { title: string; text: string }[] }>) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.title} className="rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-[var(--ac-ink)]">{item.title}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.text}</p>
        </div>
      ))}
    </div>
  );
}

export function ItemGrid({ locale, items, section }: Readonly<{ locale: Locale; items: PublicItem[]; section: "deals" | "destinations" }>) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          title={item.title[locale]}
          summary={item.summary[locale]}
          price={priceLabel(locale, item.price)}
          highlights={item.highlights[locale]}
          href={localizedPath(locale, section, item.slug[locale])}
          cta={locale === "es" ? "Ver detalle" : "View detail"}
        />
      ))}
    </div>
  );
}

export function DetailPage({ locale, slug, kind }: Readonly<{ locale: Locale; slug: string; kind: "deal" | "destination" }>) {
  const item = kind === "deal" ? findPromotion(locale, slug) : findDestination(locale, slug);
  if (!item) notFound();
  const back = kind === "deal" ? "deals" : "destinations";
  return (
    <PageShell>
      <section className="grid gap-8 rounded-[2rem] border bg-white p-6 shadow-sm lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-[var(--ac-blue)]">{item.eyebrow?.[locale] ?? "AC Travel"}</p>
          <h1 className="mt-3 text-4xl font-black text-[var(--ac-ink)] md:text-5xl">{item.title[locale]}</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">{item.description[locale]}</p>
          <p className="mt-5 text-xl font-extrabold text-[var(--ac-red)]">{priceLabel(locale, item.price)}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <WhatsAppCta message={waMessage(locale, item.title[locale])} label={locale === "es" ? "Consultar por WhatsApp" : "Ask on WhatsApp"} locale={locale} pagePath={`/${locale}/${back}/${item.slug[locale]}:detail`} className="rounded-full" />
            <Button asChild variant="outline" className="rounded-full">
              <Link href={localizedPath(locale, back)}>{locale === "es" ? "Volver" : "Back"}</Link>
            </Button>
          </div>
        </div>
        <div className="rounded-[2rem] bg-[var(--ac-light-bg)] p-6">
          <h2 className="font-black text-[var(--ac-ink)]">{locale === "es" ? "Incluye / ideas" : "Includes / ideas"}</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-zinc-700">
            {item.highlights[locale].map((highlight) => <li key={highlight}>• {highlight}</li>)}
          </ul>
          <p className="mt-6 text-xs leading-5 text-muted-foreground">
            {locale === "es" ? "Contenido estático de Block 3. Tarifas y disponibilidad se validan manualmente." : "Block 3 static content. Rates and availability are manually validated."}
          </p>
        </div>
      </section>
    </PageShell>
  );
}

export function QuotePage({ locale }: Readonly<{ locale: Locale }>) {
  return <PageShell><QuoteForm locale={locale} /></PageShell>;
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

export function FinalCta({ locale }: Readonly<{ locale: Locale }>) {
  const { t } = getPublicSiteContent(locale);
  return (
    <section className="rounded-[2rem] border bg-white p-6 shadow-sm md:flex md:items-center md:justify-between md:p-8">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[var(--ac-red)]">WhatsApp first</p>
        <h2 className="mt-2 text-2xl font-black text-[var(--ac-ink)]">{locale === "es" ? "Hablemos de tu siguiente viaje." : "Let us talk about your next trip."}</h2>
      </div>
      <WhatsAppCta message={waMessage(locale, "viaje")} label={t.primaryCta} locale={locale} pagePath={`/${locale}:final-cta`} className="mt-5 rounded-full md:mt-0" />
    </section>
  );
}
