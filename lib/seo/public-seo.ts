import type { Metadata, MetadataRoute } from "next";
import {
  findDestination,
  findPromotion,
  getPublicSiteContent,
  legalKeys,
  localizedPath,
  type LegalKey,
  type PublicItem,
} from "@/lib/content/public-site";
import { getLivePublicCatalogContent } from "@/lib/content/public-catalog";
import { type Locale, locales } from "@/lib/i18n/config";

const siteName = "AC Travel";
const defaultSocialImage: string | undefined = undefined;

type PublicRouteKey = Parameters<typeof localizedPath>[1];
type ListingRouteKey = Extract<PublicRouteKey, "services" | "packages" | "deals" | "destinations">;
type DetailKind = "deal" | "destination";
type InfoKind = "about" | "contact";

type SeoInput = {
  locale: Locale;
  title: string;
  description: string;
  path: string;
  alternatePaths: Record<Locale, string>;
};

export function getSiteUrl() {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
}

export function absoluteUrl(path: string) {
  return new URL(path, getSiteUrl()).toString();
}

function localizedOgLocale(locale: Locale) {
  return locale === "es" ? "es_MX" : "en_US";
}

function otherLocale(locale: Locale): Locale {
  return locale === "es" ? "en" : "es";
}

function buildPublicMetadata({ locale, title, description, path, alternatePaths }: SeoInput): Metadata {
  const url = absoluteUrl(path);
  const languageUrls = Object.fromEntries(locales.map((language) => [language, absoluteUrl(alternatePaths[language])])) as Record<Locale, string>;
  const images = defaultSocialImage ? [absoluteUrl(defaultSocialImage)] : undefined;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        ...languageUrls,
        "x-default": languageUrls.es,
      },
    },
    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      url,
      locale: localizedOgLocale(locale),
      alternateLocale: [localizedOgLocale(otherLocale(locale))],
      images,
    },
    twitter: {
      card: "summary",
      title,
      description,
      images,
    },
  };
}

export function buildHomeMetadata(locale: Locale) {
  const { t } = getPublicSiteContent(locale);
  return buildPublicMetadata({
    locale,
    title: t.homeTitle,
    description: t.homeDescription,
    path: `/${locale}`,
    alternatePaths: { es: "/es", en: "/en" },
  });
}

export function buildListingMetadata(locale: Locale, key: ListingRouteKey) {
  const page = getPublicSiteContent(locale).t.listingPages[key];
  return buildPublicMetadata({
    locale,
    title: page.title,
    description: page.description,
    path: localizedPath(locale, key),
    alternatePaths: { es: localizedPath("es", key), en: localizedPath("en", key) },
  });
}

export function buildInfoMetadata(locale: Locale, kind: InfoKind) {
  const { t } = getPublicSiteContent(locale);
  const title = kind === "about" ? t.aboutTitle : t.contactTitle;
  const description = kind === "about" ? t.aboutText : t.contactText;

  return buildPublicMetadata({
    locale,
    title,
    description,
    path: localizedPath(locale, kind),
    alternatePaths: { es: localizedPath("es", kind), en: localizedPath("en", kind) },
  });
}

export function buildQuoteMetadata(locale: Locale) {
  const { t } = getPublicSiteContent(locale);
  return buildPublicMetadata({
    locale,
    title: t.quoteTitle,
    description: t.quoteText,
    path: localizedPath(locale, "quote"),
    alternatePaths: { es: localizedPath("es", "quote"), en: localizedPath("en", "quote") },
  });
}

export function buildLegalMetadata(locale: Locale, legalKey: LegalKey) {
  const { t } = getPublicSiteContent(locale);
  const [title, description] = t.legal[legalKey];

  return buildPublicMetadata({
    locale,
    title,
    description,
    path: localizedPath(locale, legalKey === "payments" ? "payments" : legalKey),
    alternatePaths: {
      es: localizedPath("es", legalKey === "payments" ? "payments" : legalKey),
      en: localizedPath("en", legalKey === "payments" ? "payments" : legalKey),
    },
  });
}

export async function buildDetailMetadata(locale: Locale, kind: DetailKind, slug: string) {
  const catalog = await getLivePublicCatalogContent(locale).catch(() => null);
  const item = catalog
    ? (kind === "deal" ? catalog.promotions : catalog.destinations).find((entry) => entry.slug[locale] === slug)
    : (kind === "deal" ? findPromotion(locale, slug) : findDestination(locale, slug));
  const listKey = kind === "deal" ? "deals" : "destinations";

  if (!item) {
    return buildListingMetadata(locale, listKey);
  }

  return buildItemMetadata(locale, kind, item);
}

function buildItemMetadata(locale: Locale, kind: DetailKind, item: PublicItem) {
  const listKey = kind === "deal" ? "deals" : "destinations";
  return buildPublicMetadata({
    locale,
    title: item.title[locale],
    description: item.summary[locale] || item.description[locale],
    path: localizedPath(locale, listKey, item.slug[locale]),
    alternatePaths: {
      es: localizedPath("es", listKey, item.slug.es),
      en: localizedPath("en", listKey, item.slug.en),
    },
  });
}

export async function getPublicSeoSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const addEntry = (path: string, alternates: Record<Locale, string>) => {
    entries.push({
      url: absoluteUrl(path),
      alternates: {
        languages: {
          es: absoluteUrl(alternates.es),
          en: absoluteUrl(alternates.en),
        },
      },
    });
  };

  for (const locale of locales) addEntry(`/${locale}`, { es: "/es", en: "/en" });

  const listingKeys: ListingRouteKey[] = ["services", "packages", "deals", "destinations"];
  for (const key of listingKeys) {
    for (const locale of locales) addEntry(localizedPath(locale, key), { es: localizedPath("es", key), en: localizedPath("en", key) });
  }

  const infoKeys: InfoKind[] = ["about", "contact"];
  for (const key of infoKeys) {
    for (const locale of locales) addEntry(localizedPath(locale, key), { es: localizedPath("es", key), en: localizedPath("en", key) });
  }

  for (const locale of locales) {
    addEntry(localizedPath(locale, "quote"), {
      es: localizedPath("es", "quote"),
      en: localizedPath("en", "quote"),
    });
  }

  for (const key of legalKeys) {
    const routeKey = key === "payments" ? "payments" : key;
    for (const locale of locales) addEntry(localizedPath(locale, routeKey), { es: localizedPath("es", routeKey), en: localizedPath("en", routeKey) });
  }

  const catalog = (await getLivePublicCatalogContent("es").catch(() => null)) ?? getPublicSiteContent("es");
  for (const item of catalog.promotions) {
    for (const locale of locales) addEntry(localizedPath(locale, "deals", item.slug[locale]), { es: localizedPath("es", "deals", item.slug.es), en: localizedPath("en", "deals", item.slug.en) });
  }

  for (const item of catalog.destinations) {
    for (const locale of locales) addEntry(localizedPath(locale, "destinations", item.slug[locale]), { es: localizedPath("es", "destinations", item.slug.es), en: localizedPath("en", "destinations", item.slug.en) });
  }

  return entries;
}
