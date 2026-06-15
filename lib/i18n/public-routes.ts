import { type Locale } from "@/lib/i18n/config";
import { translateSlug } from "@/lib/content/public-site";

type RouteInfo = {
  title: string;
  description: string;
  allowsSlug?: boolean;
};

const publicRoutes: Record<Locale, Record<string, RouteInfo>> = {
  es: {
    servicios: { title: "Servicios", description: "Placeholder para servicios turísticos del MVP." },
    paquetes: { title: "Paquetes", description: "Placeholder para paquetes vacacionales.", allowsSlug: true },
    promociones: { title: "Promociones", description: "Placeholder para promociones.", allowsSlug: true },
    destinos: { title: "Destinos", description: "Placeholder para destinos.", allowsSlug: true },
    cotizar: { title: "Cotizar", description: "Placeholder para flujo de cotización." },
    nosotros: { title: "Nosotros", description: "Placeholder para información de AC Travel." },
    contacto: { title: "Contacto", description: "Placeholder para datos de contacto." },
    privacidad: { title: "Privacidad", description: "Placeholder para aviso de privacidad." },
    terminos: { title: "Términos", description: "Placeholder para términos y condiciones." },
    "pagos-cancelaciones": { title: "Pagos y cancelaciones", description: "Placeholder para políticas de pago y cancelación." },
  },
  en: {
    services: { title: "Services", description: "Placeholder for travel services." },
    packages: { title: "Packages", description: "Placeholder for vacation packages.", allowsSlug: true },
    deals: { title: "Deals", description: "Placeholder for deals.", allowsSlug: true },
    destinations: { title: "Destinations", description: "Placeholder for destinations.", allowsSlug: true },
    quote: { title: "Quote", description: "Placeholder for the quote flow." },
    about: { title: "About", description: "Placeholder for AC Travel information." },
    contact: { title: "Contact", description: "Placeholder for contact details." },
    privacy: { title: "Privacy", description: "Placeholder for the privacy notice." },
    terms: { title: "Terms", description: "Placeholder for terms and conditions." },
    "payments-cancellations": { title: "Payments and cancellations", description: "Placeholder for payment and cancellation policies." },
  },
};

const localizedRoutePairs: Record<Locale, Record<string, string>> = {
  es: {
    servicios: "services",
    paquetes: "packages",
    promociones: "deals",
    destinos: "destinations",
    cotizar: "quote",
    nosotros: "about",
    contacto: "contact",
    privacidad: "privacy",
    terminos: "terms",
    "pagos-cancelaciones": "payments-cancellations",
  },
  en: {
    services: "servicios",
    packages: "paquetes",
    deals: "promociones",
    destinations: "destinos",
    quote: "cotizar",
    about: "nosotros",
    contact: "contacto",
    privacy: "privacidad",
    terms: "terminos",
    "payments-cancellations": "pagos-cancelaciones",
  },
};

export function getLocalizedPath(pathname: string, targetLocale: Locale, alternateHref?: string | null) {
  const alternatePath = resolveAlternateLocalizedPath(targetLocale, alternateHref) ?? localizedAlternatePath(targetLocale);

  if (alternatePath) {
    return alternatePath;
  }

  const parts = pathname.split("/").filter(Boolean);
  const [currentLocale, section, slug] = parts;

  if (!isKnownLocale(currentLocale)) {
    return `/${targetLocale}`;
  }

  if (!section) {
    return `/${targetLocale}`;
  }

  const localizedSection = localizedRoutePairs[currentLocale][section];

  if (!localizedSection) {
    return `/${targetLocale}`;
  }

  const localizedSlug = translateSlug(section, currentLocale, targetLocale, slug);

  return localizedSlug ? `/${targetLocale}/${localizedSection}/${localizedSlug}` : slug ? `/${targetLocale}/${localizedSection}/${slug}` : `/${targetLocale}/${localizedSection}`;
}

export function resolveAlternateLocalizedPath(targetLocale: Locale, href?: string | null) {
  if (!href) return null;

  try {
    const { pathname, search, hash } = new URL(href, "https://actravel.local");
    const localizedPath = `${pathname}${search}${hash}`;
    return localizedPath === `/${targetLocale}` || localizedPath.startsWith(`/${targetLocale}/`) ? localizedPath : null;
  } catch {
    return null;
  }
}

function localizedAlternatePath(targetLocale: Locale) {
  if (typeof document === "undefined") return null;

  const alternateHref = document.head
    .querySelector(`link[rel="alternate"][hreflang="${targetLocale}"]`)
    ?.getAttribute("href");

  return resolveAlternateLocalizedPath(targetLocale, alternateHref);
}

function isKnownLocale(value: string | undefined): value is Locale {
  return value === "es" || value === "en";
}

export function getPublicRoute(locale: Locale, segments: string[]) {
  const [section, slug, extra] = segments;
  const route = publicRoutes[locale][section];

  if (!route || extra || (slug && !route.allowsSlug)) {
    return null;
  }

  return { ...route, slug };
}

export function getPublicRouteSegments() {
  return Object.entries(publicRoutes).flatMap(([locale, routes]) =>
    Object.entries(routes).flatMap(([section, route]) => {
      const base = { locale, segments: [section] };
      return route.allowsSlug ? [base, { locale, segments: [section, "placeholder"] }] : [base];
    }),
  );
}
