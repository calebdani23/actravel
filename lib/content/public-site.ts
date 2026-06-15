import { type Locale } from "@/lib/i18n/config";
import { resolveCatalogMediaUrl } from "@/lib/catalog-media";

type Localized = Record<Locale, string>;
export type PriceDisplay = { type: "from"; mxn?: number; usd?: number } | { type: "consult" };
export type ValueItem = { title: Localized; text: Localized; eyebrow?: Localized };
export type FAQItem = { question: string; answer: string };
type ListingKind = "services" | "packages" | "deals" | "destinations";
export type ListingCopy = {
  eyebrow: string;
  title: string;
  description: string;
  note: string;
  ctaTitle: string;
  ctaText: string;
  ctaTopic: string;
};

export type PublicItem = {
  id: string;
  slug: Localized;
  title: Localized;
  summary: Localized;
  description: Localized;
  media?: {
    heroImageUrl?: string | null;
    thumbnailImageUrl?: string | null;
  };
  eyebrow?: Localized;
  highlights: Record<Locale, string[]>;
  bestFor?: Localized;
  planningNotes?: Record<Locale, string[]>;
  detailCta?: Localized;
  detailNote?: Localized;
  price: PriceDisplay;
  featured?: boolean;
};

export type QuoteFormCopy = {
  eyebrow: string;
  title: string;
  description: string;
  requiredMarker: string;
  optionalMarker: string;
  submit: string;
  submitting: string;
  successTitle: string;
  successNextStep: string;
  successDisclaimer: string;
  successWhatsAppHelp: string;
  failureTitle: string;
  failureRecovery: string;
  whatsappCta: string;
  reset: string;
  sections: Record<"contact" | "trip" | "context", { title: string; description: string }>;
  fields: Record<
    | "holderName"
    | "email"
    | "whatsapp"
    | "origin"
    | "mainDestination"
    | "departureDate"
    | "returnDate"
    | "adults"
    | "children"
    | "serviceInterest"
    | "approximateBudget"
    | "sourceChannel"
    | "preferredCurrency"
    | "notes"
    | "contactConsent",
    string
  >;
  placeholders: Record<string, string>;
  hints: Record<string, string>;
  serviceOptions: string[];
  sourceOptions: string[];
};

const routeNames = {
  es: {
    services: "servicios",
    packages: "paquetes",
    deals: "promociones",
    destinations: "destinos",
    quote: "cotizar",
    about: "nosotros",
    contact: "contacto",
    privacy: "privacidad",
    terms: "terminos",
    payments: "pagos-cancelaciones",
  },
  en: {
    services: "services",
    packages: "packages",
    deals: "deals",
    destinations: "destinations",
    quote: "quote",
    about: "about",
    contact: "contact",
    privacy: "privacy",
    terms: "terms",
    payments: "payments-cancellations",
  },
} as const;

const destinations: PublicItem[] = [
  {
    id: "cancun",
    slug: { es: "cancun", en: "cancun" },
    title: { es: "Cancún", en: "Cancun" },
    summary: { es: "Playas turquesa, hoteles todo incluido y vida nocturna.", en: "Turquoise beaches, all-inclusive hotels, and nightlife." },
    description: {
      es: "Ideal para familias, parejas y grupos que quieren una base cómoda con tours, traslados y hoteles para distintos presupuestos.",
      en: "Ideal for families, couples, and groups looking for a comfortable base with tours, transfers, and hotels for different budgets.",
    },
    highlights: { es: ["Hoteles frente al mar", "Tours a islas y cenotes", "Traslados privados o compartidos"], en: ["Beachfront hotels", "Island and cenote tours", "Private or shared transfers"] },
    bestFor: { es: "Familias, parejas y grupos que quieren playa, servicios y logística sencilla.", en: "Families, couples, and groups who want beach time, services, and simple logistics." },
    planningNotes: { es: ["Conviene definir zona hotelera, tipo de plan y traslados desde el aeropuerto.", "Las tarifas dependen de fechas, ocupación, hotel final e impuestos."], en: ["It helps to define hotel zone, meal plan, and airport transfer type.", "Rates depend on dates, occupancy, final hotel, and taxes."] },
    detailCta: { es: "Quiero opciones para Cancún", en: "I want Cancun options" },
    detailNote: { es: "Precio desde informativo para iniciar cotización; se valida manualmente antes de confirmar.", en: "Informational from-price to start a quote; manually validated before confirmation." },
    price: { type: "from", mxn: 8900, usd: 520 },
    featured: true,
  },
  {
    id: "riviera-maya",
    slug: { es: "riviera-maya", en: "riviera-maya" },
    title: { es: "Riviera Maya", en: "Riviera Maya" },
    summary: { es: "Resorts, naturaleza y experiencias entre playa y selva.", en: "Resorts, nature, and experiences between beach and jungle." },
    description: {
      es: "Una zona flexible para combinar descanso, parques, cenotes, gastronomía y escapadas culturales con asesoría personalizada.",
      en: "A flexible area for combining rest, parks, cenotes, food, and cultural escapes with personalized guidance.",
    },
    highlights: { es: ["Todo incluido", "Parques y cenotes", "Opciones para luna de miel"], en: ["All-inclusive stays", "Parks and cenotes", "Honeymoon-friendly options"] },
    bestFor: { es: "Viajeros que buscan combinar resort, naturaleza, parques y escapadas culturales.", en: "Travelers who want to combine resort time, nature, parks, and cultural day trips." },
    planningNotes: { es: ["La zona exacta cambia distancias a parques, cenotes y restaurantes.", "Podemos comparar descanso total, viaje activo o mezcla de ambos."], en: ["The exact area changes distances to parks, cenotes, and restaurants.", "We can compare full rest, active travel, or a mix of both."] },
    detailCta: { es: "Comparar opciones en Riviera Maya", en: "Compare Riviera Maya options" },
    detailNote: { es: "Las opciones finales dependen de fechas, perfil del hotel y condiciones del proveedor.", en: "Final options depend on dates, hotel profile, and supplier conditions." },
    price: { type: "from", mxn: 9600, usd: 560 },
    featured: true,
  },
  {
    id: "playa-del-carmen",
    slug: { es: "playa-del-carmen", en: "playa-del-carmen" },
    title: { es: "Playa del Carmen", en: "Playa del Carmen" },
    summary: { es: "Ambiente caminable, beach clubs y acceso a tours.", en: "Walkable atmosphere, beach clubs, and easy tour access." },
    description: {
      es: "Perfecto para quienes buscan moverse fácil, estar cerca de restaurantes y tener múltiples salidas a tours desde un punto central.",
      en: "Perfect for travelers who want easy mobility, nearby restaurants, and multiple tour departures from a central point.",
    },
    highlights: { es: ["Hoteles boutique", "Quinta Avenida", "Tours cercanos"], en: ["Boutique hotels", "Fifth Avenue", "Nearby tours"] },
    bestFor: { es: "Personas que prefieren ambiente caminable, restaurantes cerca y salidas fáciles a tours.", en: "Travelers who prefer a walkable vibe, nearby restaurants, and easy tour departures." },
    planningNotes: { es: ["Revisamos si conviene hotel céntrico, playa o una zona más tranquila.", "La disponibilidad se confirma con proveedor antes de apartar."], en: ["We review whether downtown, beachfront, or a quieter area fits best.", "Availability is confirmed with the supplier before holding anything."] },
    detailCta: { es: "Cotizar Playa del Carmen", en: "Quote Playa del Carmen" },
    detailNote: { es: "Destino bajo consulta: primero validamos fechas, zona y estilo de hospedaje.", en: "Check-availability destination: we first validate dates, area, and lodging style." },
    price: { type: "consult" },
    featured: true,
  },
];

const promotions: PublicItem[] = [
  {
    id: "caribe-familiar",
    slug: { es: "caribe-familiar", en: "family-caribbean" },
    title: { es: "Caribe familiar", en: "Family Caribbean" },
    summary: { es: "Hotel, traslados y opciones de tour para viajar con niños.", en: "Hotel, transfers, and tour options for traveling with children." },
    description: {
      es: "Promoción muestra para iniciar conversación. La disponibilidad, fechas, hotel final e impuestos se confirman con una asesora.",
      en: "Sample deal to start a conversation. Availability, dates, final hotel, and taxes are confirmed by an advisor.",
    },
    eyebrow: { es: "Muestra", en: "Sample" },
    highlights: { es: ["4 días / 3 noches", "Hotel sugerido", "Asesoría por WhatsApp"], en: ["4 days / 3 nights", "Suggested hotel", "WhatsApp advisory"] },
    bestFor: { es: "Familias que buscan una idea base para ordenar hotel, traslados y actividades.", en: "Families who need a starting idea to organize hotel, transfers, and activities." },
    planningNotes: { es: ["La muestra ayuda a definir presupuesto y estilo; no bloquea hotel ni tarifa.", "Edades de menores y fechas cambian la propuesta final."], en: ["The sample helps define budget and style; it does not hold hotel or rate.", "Children's ages and dates change the final proposal."] },
    detailCta: { es: "Pedir propuesta familiar", en: "Request a family proposal" },
    detailNote: { es: "Promoción muestra: disponibilidad, impuestos y hotel se confirman con una asesora.", en: "Sample deal: availability, taxes, and hotel are confirmed by an advisor." },
    price: { type: "from", mxn: 12900, usd: 750 },
    featured: true,
  },
  {
    id: "escapada-romantica",
    slug: { es: "escapada-romantica", en: "romantic-escape" },
    title: { es: "Escapada romántica", en: "Romantic escape" },
    summary: { es: "Opciones para pareja con hotel, detalles y traslados.", en: "Couple-friendly options with hotel, thoughtful touches, and transfers." },
    description: {
      es: "Diseñamos propuestas según fechas, estilo de hotel y presupuesto; no es inventario en tiempo real.",
      en: "We design proposals around dates, hotel style, and budget; this is not real-time inventory.",
    },
    highlights: { es: ["Hoteles boutique o resort", "Sorpresas opcionales", "Cotización personalizada"], en: ["Boutique or resort hotels", "Optional surprises", "Personalized quote"] },
    bestFor: { es: "Parejas que quieren comparar ambiente, detalles especiales y presupuesto realista.", en: "Couples who want to compare vibe, special touches, and realistic budget." },
    planningNotes: { es: ["Podemos orientar entre resort, boutique, adultos-only o ubicación más privada.", "Los extras dependen de proveedor, fecha y condiciones confirmadas."], en: ["We can guide resort, boutique, adults-only, or more private location choices.", "Extras depend on supplier, date, and confirmed conditions."] },
    detailCta: { es: "Diseñar escapada romántica", en: "Design a romantic escape" },
    detailNote: { es: "Idea flexible bajo consulta; no representa inventario en tiempo real.", en: "Flexible check-availability idea; not real-time inventory." },
    price: { type: "consult" },
    featured: true,
  },
  {
    id: "aventura-riviera",
    slug: { es: "aventura-riviera", en: "riviera-adventure" },
    title: { es: "Aventura Riviera", en: "Riviera adventure" },
    summary: { es: "Base de hotel más tours a cenotes, parques o zonas arqueológicas.", en: "Hotel base plus tours to cenotes, parks, or archaeological areas." },
    description: {
      es: "Una idea flexible para armar viaje activo con tiempos realistas y acompañamiento humano.",
      en: "A flexible idea for building an active trip with realistic timing and human support.",
    },
    highlights: { es: ["Tours combinables", "Rutas sugeridas", "Opciones por presupuesto"], en: ["Mix-and-match tours", "Suggested routes", "Budget-based options"] },
    bestFor: { es: "Viajeros activos que quieren playa, cenotes, parques o arqueología sin saturar agenda.", en: "Active travelers who want beach, cenotes, parks, or archaeology without overpacking the schedule." },
    planningNotes: { es: ["Ordenamos tiempos de traslado para evitar itinerarios poco realistas.", "Tours, horarios y precios se validan antes de confirmar."], en: ["We organize transfer times to avoid unrealistic itineraries.", "Tours, schedules, and prices are validated before confirmation."] },
    detailCta: { es: "Armar viaje de aventura", en: "Build an adventure trip" },
    detailNote: { es: "Precio desde orientativo; actividades y horarios finales se confirman manualmente.", en: "Orientational from-price; final activities and schedules are manually confirmed." },
    price: { type: "from", mxn: 15400, usd: 890 },
  },
];

const services: (ValueItem & { id: string })[] = [
  { id: "hotels", eyebrow: { es: "Hospedaje", en: "Stays" }, title: { es: "Hoteles y resorts", en: "Hotels and resorts" }, text: { es: "Comparamos zonas, régimen de alimentos y estilo de hotel para que la opción tenga sentido con tu presupuesto.", en: "We compare areas, meal plans, and hotel style so the option matches your budget." } },
  { id: "packages", eyebrow: { es: "Coordinado", en: "Coordinated" }, title: { es: "Paquetes vacacionales", en: "Vacation packages" }, text: { es: "Integramos hotel, traslados, tours y extras como propuesta revisada, no como carrito automático.", en: "We combine hotel, transfers, tours, and extras into a reviewed proposal, not an automatic cart." } },
  { id: "tours", eyebrow: { es: "Experiencias", en: "Experiences" }, title: { es: "Tours y experiencias", en: "Tours and experiences" }, text: { es: "Sugerimos actividades con tiempos realistas y condiciones claras antes de apartar.", en: "We suggest activities with realistic timing and clear conditions before booking." } },
  { id: "transfers", eyebrow: { es: "Llegada", en: "Arrival" }, title: { es: "Traslados", en: "Transfers" }, text: { es: "Privados o compartidos según aeropuerto, hotel, horarios y tamaño del grupo.", en: "Private or shared based on airport, hotel, schedule, and group size." } },
  { id: "homes", eyebrow: { es: "Grupos", en: "Groups" }, title: { es: "Casas vacacionales", en: "Vacation homes" }, text: { es: "Alternativas para familias y grupos cuando conviene más espacio, cocina o privacidad.", en: "Alternatives for families and groups when more space, kitchen access, or privacy matters." } },
  { id: "advisory", eyebrow: { es: "Guía", en: "Guidance" }, title: { es: "Asesoría personalizada", en: "Personalized advisory" }, text: { es: "Te ayudamos a ordenar opciones, entender condiciones y decidir el siguiente paso con acompañamiento humano.", en: "We help organize options, understand conditions, and decide next steps with human support." } },
];

const packages: ValueItem[] = [
  { eyebrow: { es: "Con menores", en: "With children" }, title: { es: "Familia", en: "Family" }, text: { es: "Planes con tiempos cómodos, hoteles prácticos, traslados claros y actividades aptas para edades reales.", en: "Plans with comfortable timing, practical hotels, clear transfers, and activities suited to actual ages." } },
  { eyebrow: { es: "Pareja", en: "Couples" }, title: { es: "Escapadas en pareja", en: "Couple getaways" }, text: { es: "Comparamos ambiente, privacidad, detalles especiales y condiciones para aniversarios o luna de miel.", en: "We compare vibe, privacy, special touches, and conditions for anniversaries or honeymoons." } },
  { eyebrow: { es: "Coordinación", en: "Coordination" }, title: { es: "Grupos", en: "Groups" }, text: { es: "Ordenamos habitaciones, traslados y actividades para amigos, empresas o celebraciones.", en: "We organize rooms, transfers, and activities for friends, companies, or celebrations." } },
];

export function getPublicSiteContent(locale: Locale) {
  const t = copy[locale];
  return { locale, routes: routeNames[locale], t, services, packages, destinations, promotions };
}

type PublicSiteContent = ReturnType<typeof getPublicSiteContent>;

export type PublicCatalogContent = Omit<PublicSiteContent, "services" | "packages"> & {
  services: PublicItem[];
  packages: PublicItem[];
  destinations: PublicItem[];
  promotions: PublicItem[];
};

export type HomeServiceItem = {
  id: string;
  title: Localized;
  text: Localized;
  eyebrow?: Localized;
};

export type PublicHomeContent = Omit<PublicCatalogContent, "services"> & { services: HomeServiceItem[] };
export type HomeCatalogSource = Omit<PublicCatalogContent, "services" | "packages"> & {
  services: Array<PublicItem | HomeServiceItem | ValueItem>;
  packages: PublicItem[];
};

export type CatalogRowLike = {
  id: string;
  slug_es?: string | null;
  slug_en?: string | null;
  name_es?: string | null;
  name_en?: string | null;
  title_es?: string | null;
  title_en?: string | null;
  summary_es?: string | null;
  summary_en?: string | null;
  description_es?: string | null;
  description_en?: string | null;
  details_es?: string | null;
  details_en?: string | null;
  is_featured?: boolean | null;
  status?: string | null;
  published_at?: string | null;
  country?: string | null;
  region?: string | null;
  hero_image_url?: string | null;
  thumbnail_image_url?: string | null;
  price_from_mxn?: number | string | null;
  price_from_usd?: number | string | null;
  sort_order?: number | null;
  destination_id?: string | null;
  service_id?: string | null;
};

function toNumber(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function catalogMedia(row: CatalogRowLike) {
  const heroImageUrl = resolveCatalogMediaUrl(row.hero_image_url);
  const thumbnailImageUrl = resolveCatalogMediaUrl(row.thumbnail_image_url);
  if (!heroImageUrl && !thumbnailImageUrl) return undefined;
  return { heroImageUrl, thumbnailImageUrl };
}

export function buildPublicCatalogItem(row: CatalogRowLike, kind: "destinations" | "services" | "packages" | "promotions"): PublicItem {
  const slug = { es: row.slug_es ?? row.id, en: row.slug_en ?? row.slug_es ?? row.id };
  const priceFrom = toNumber(row.price_from_mxn) || toNumber(row.price_from_usd);
  if (kind === "destinations") {
    return {
      id: row.id,
      slug,
      title: { es: row.name_es ?? "", en: row.name_en ?? "" },
      summary: { es: row.summary_es ?? "", en: row.summary_en ?? "" },
      description: { es: row.description_es ?? row.summary_es ?? "", en: row.description_en ?? row.summary_en ?? "" },
      media: catalogMedia(row),
      highlights: { es: [], en: [] },
      price: { type: "consult" },
      featured: Boolean(row.is_featured),
    };
  }

  if (kind === "services" || kind === "packages") {
    return {
      id: row.id,
      slug,
      title: { es: row.name_es ?? "", en: row.name_en ?? "" },
      summary: { es: row.summary_es ?? "", en: row.summary_en ?? "" },
      description: { es: row.description_es ?? row.summary_es ?? "", en: row.description_en ?? row.summary_en ?? "" },
      media: catalogMedia(row),
      highlights: { es: [], en: [] },
      price: priceFrom ? { type: "from", mxn: toNumber(row.price_from_mxn), usd: toNumber(row.price_from_usd) } : { type: "consult" },
      featured: Boolean(row.is_featured),
    };
  }

  return {
    id: row.id,
    slug,
    title: { es: row.title_es ?? row.name_es ?? "", en: row.title_en ?? row.name_en ?? "" },
    summary: { es: row.summary_es ?? "", en: row.summary_en ?? "" },
    description: { es: row.details_es ?? row.description_es ?? row.summary_es ?? "", en: row.details_en ?? row.description_en ?? row.summary_en ?? "" },
    eyebrow: { es: "Promoción", en: "Promotion" },
    media: catalogMedia(row),
    highlights: { es: [], en: [] },
    price: priceFrom ? { type: "from", mxn: toNumber(row.price_from_mxn), usd: toNumber(row.price_from_usd) } : { type: "consult" },
    featured: Boolean(row.is_featured),
  };
}

type PublicCatalogRows = {
  destinations: CatalogRowLike[];
  services: CatalogRowLike[];
  packages: CatalogRowLike[];
  promotions: CatalogRowLike[];
};

export function buildPublicCatalogContent(locale: Locale, rows?: Partial<PublicCatalogRows> | null): PublicCatalogContent {
  const staticContent = getPublicSiteContent(locale);
  if (!rows) {
    return buildFallbackCatalogContent(locale);
  }

  const destinations = publishedCatalogRows(rows.destinations ?? []).map((row) => buildPublicCatalogItem(row, "destinations"));
  const services = publishedCatalogRows(rows.services ?? []).map((row) => buildPublicCatalogItem(row, "services"));
  const packages = publishedCatalogRows(rows.packages ?? []).map((row) => buildPublicCatalogItem(row, "packages"));
  const promotions = publishedCatalogRows(rows.promotions ?? []).map((row) => buildPublicCatalogItem(row, "promotions"));

  return {
    ...staticContent,
    services,
    packages,
    destinations,
    promotions,
  };
}

function staticServiceCatalogItems(): PublicItem[] {
  return services.map((service) => ({
    id: service.id,
    slug: { es: service.id, en: service.id },
    title: service.title,
    summary: service.text,
    description: service.text,
    eyebrow: service.eyebrow,
    highlights: { es: [], en: [] },
    price: { type: "consult" },
  }));
}

function staticPackageCatalogItems(): PublicItem[] {
  return packages.map((item, index) => ({
    id: `static-package-${index + 1}`,
    slug: { es: `paquete-${index + 1}`, en: `package-${index + 1}` },
    title: item.title,
    summary: item.text,
    description: item.text,
    eyebrow: item.eyebrow,
    highlights: { es: [], en: [] },
    price: { type: "consult" },
  }));
}

export function buildFallbackCatalogContent(locale: Locale): PublicCatalogContent {
  const staticContent = getPublicSiteContent(locale);

  return {
    ...staticContent,
    destinations,
    promotions,
    services: staticServiceCatalogItems(),
    packages: staticPackageCatalogItems(),
  };
}

export function mergeCatalogWithFallback(locale: Locale, catalog?: Partial<PublicCatalogContent> | null): PublicCatalogContent {
  const fallback = buildFallbackCatalogContent(locale);

  return {
    ...fallback,
    ...catalog,
    destinations: catalog?.destinations?.length ? catalog.destinations : fallback.destinations,
    services: catalog?.services?.length ? catalog.services : fallback.services,
    packages: catalog?.packages?.length ? catalog.packages : fallback.packages,
    promotions: catalog?.promotions?.length ? catalog.promotions : fallback.promotions,
  };
}

export function getPublicPackagesContent(locale: Locale) {
  return getPublicSiteContent(locale).packages;
}

function toHomeServiceItem(item: PublicItem | (ValueItem & { id: string }) | ValueItem): HomeServiceItem {
  if ("text" in item) {
    return {
      id: "id" in item ? item.id : item.title.es,
      title: item.title,
      text: item.text,
      eyebrow: item.eyebrow,
    };
  }

  return {
    id: item.id,
    title: item.title,
    text: item.description,
    eyebrow: item.eyebrow,
  };
}

function pickHomeItems<T>(items: T[], limit?: number) {
  const featured = items.filter((item) => (item as { featured?: boolean }).featured);
  const selected = featured.length > 0 ? featured : items;
  return typeof limit === "number" ? selected.slice(0, limit) : selected;
}

export function buildPublicHomeContent(locale: Locale, catalog?: HomeCatalogSource | null): PublicHomeContent {
  const staticContent = getPublicSiteContent(locale);
  if (!catalog) {
    return {
      ...staticContent,
      destinations: [],
      packages: [],
      promotions: [],
      services: [],
    };
  }

  return {
    ...staticContent,
    destinations: pickHomeItems(catalog.destinations),
    packages: pickHomeItems(catalog.packages),
    promotions: pickHomeItems(catalog.promotions),
    services: pickHomeItems(catalog.services, 3).map(toHomeServiceItem),
  };
}

export function publishedCatalogRows<T extends { status?: string | null; is_featured?: boolean | null; published_at?: string | null; sort_order?: number | null }>(rows: T[]) {
  return rows
    .filter((row) => row.status === "published")
    .sort((a, b) => Number(b.is_featured ?? false) - Number(a.is_featured ?? false) || Number(b.published_at ? new Date(b.published_at).getTime() : 0) - Number(a.published_at ? new Date(a.published_at).getTime() : 0) || Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
}

export function localizedPath(locale: Locale, key: keyof typeof routeNames.es, slug?: string) {
  return `/${locale}/${routeNames[locale][key]}${slug ? `/${slug}` : ""}`;
}

export function findPromotion(locale: Locale, slug: string) {
  return promotions.find((item) => item.slug[locale] === slug);
}

export function findDestination(locale: Locale, slug: string) {
  return destinations.find((item) => item.slug[locale] === slug);
}

export function translateSlug(section: string, from: Locale, to: Locale, slug?: string) {
  if (!slug) return undefined;
  const collection = section === routeNames[from].deals ? promotions : section === routeNames[from].destinations ? destinations : section === routeNames[from].packages ? staticPackageCatalogItems() : [];
  return collection.find((item) => item.slug[from] === slug)?.slug[to];
}

export function priceLabel(locale: Locale, price: PriceDisplay) {
  if (price.type === "consult") return locale === "es" ? "Consultar" : "Check availability";
  const amount = locale === "es" ? price.mxn : price.usd;
  const currency = locale === "es" ? "MXN" : "USD";
  return `${locale === "es" ? "Desde" : "From"} ${new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount ?? 0)}`;
}

export function waMessage(locale: Locale, topic: string) {
  return locale === "es"
    ? `Hola AC Travel Mx, quisiera información sobre ${topic}.`
    : `Hi AC Travel Mx, I would like information about ${topic}.`;
}

export function quoteConfirmationMessage(locale: Locale, name: string, destination: string) {
  return locale === "es"
    ? `Gracias, ${name}. Recibimos tu solicitud para ${destination}. Una asesora de AC Travel Mx revisará tus datos y te contactará por WhatsApp para afinar opciones.`
    : `Thank you, ${name}. We received your request for ${destination}. An AC Travel Mx advisor will review your details and contact you on WhatsApp to refine options.`;
}

export function quoteWhatsAppMessage(locale: Locale, name: string, destination: string) {
  return locale === "es"
    ? `Hola AC Travel Mx, soy ${name}. Ya envié mi solicitud de cotización para ${destination} y quiero continuar por WhatsApp.`
    : `Hi AC Travel Mx, this is ${name}. I submitted my quote request for ${destination} and would like to continue on WhatsApp.`;
}

export const legalKeys = ["privacy", "terms", "payments"] as const;
export type LegalKey = (typeof legalKeys)[number];

export const copy = {
  es: {
    heroKicker: "Agencia de viajes en México",
    homeTitle: "Viajes a México y Caribe con asesoría humana desde WhatsApp.",
    homeDescription: "Te ayudamos a comparar destinos, hoteles, traslados y experiencias para armar una propuesta clara. No hay checkout automático: primero entendemos tu viaje y validamos disponibilidad.",
    heroSupport: ["Cancún, Riviera Maya, Playa del Carmen y más", "Opciones por presupuesto, estilo y fechas", "Seguimiento humano antes de confirmar"],
    primaryCta: "Cotizar por WhatsApp",
    quoteCta: "Preparar mi cotización",
    viewDeals: "Ver promociones",
    sections: {
      benefits: ["Viajar con más claridad", "Antes de elegir hotel o tour, aterrizamos presupuesto, fechas, zona y condiciones para evitar decisiones a ciegas."],
      destinations: ["Destinos destacados", "Elige una base y armamos el resto contigo."],
      deals: ["Promociones muestra", "Ideas de viaje para iniciar conversación; disponibilidad final se confirma con una asesora."],
      services: ["Servicios", "Todo lo necesario para planear mejor y viajar con tranquilidad."],
      process: ["Cómo funciona", "Sin compra automática: primero escuchamos, luego proponemos."],
      trust: ["Por qué AC Travel", "Acompañamiento cercano, opciones claras y enfoque humano."],
      faq: ["Preguntas frecuentes", "Respuestas rápidas antes de pedir una cotización."],
    },
    benefits: [
      { title: "Opciones ordenadas", text: "Filtramos zonas, hoteles y experiencias para que compares menos ruido y mejores alternativas.", eyebrow: "Claridad" },
      { title: "Presupuesto realista", text: "Usamos precios desde o bajo consulta como punto de partida y validamos condiciones antes de confirmar.", eyebrow: "Sin promesas falsas" },
      { title: "Viaje coordinado", text: "Podemos conectar hotel, traslados, tours y extras para que el itinerario sea práctico.", eyebrow: "Logística" },
      { title: "Acompañamiento humano", text: "WhatsApp sigue siendo el canal principal para resolver dudas y ajustar la propuesta.", eyebrow: "Cercanía" },
    ],
    process: ["Comparte destino, fechas, personas, origen y presupuesto aproximado.", "Una asesora compara opciones, disponibilidad y condiciones del proveedor.", "Recibes una propuesta clara y decides si avanzamos con seguimiento humano."],
    trust: ["WhatsApp como canal principal", "Tarifas desde o bajo consulta, siempre validadas", "Disponibilidad manual: no prometemos inventario en tiempo real"],
    faq: [
      { question: "¿Los precios publicados son finales?", answer: "No. Son referencias desde o ideas bajo consulta. Impuestos, hotel final, fechas y condiciones se validan manualmente antes de confirmar." },
      { question: "¿Cómo confirman disponibilidad?", answer: "Después de recibir tu contexto revisamos opciones con proveedores o fuentes operativas y te explicamos qué está disponible y bajo qué condiciones." },
      { question: "¿Qué datos necesito para cotizar?", answer: "Destino, ciudad de origen, fechas tentativas, número de viajeros, edades de menores, presupuesto y estilo de viaje. El formulario ayuda a preparar mejor la conversación por WhatsApp." },
      { question: "¿WhatsApp y formulario son lo mismo?", answer: "Trabajan juntos: WhatsApp es el canal principal y el formulario guarda la solicitud para que una asesora llegue con más contexto." },
      { question: "¿Pagos y cancelaciones dependen de AC Travel?", answer: "Dependen de proveedor, tarifa, fecha y condiciones confirmadas. Consulta la página de pagos y cancelaciones para la guía provisional." },
    ],
    finalCta: { title: "Tu viaje empieza con una conversación clara.", text: "Cuéntanos qué tienes en mente y una asesora te orienta con opciones realistas antes de comprar.", whatsappTopic: "mi próximo viaje", quoteLabel: "Enviar datos de viaje" },
    listingPages: {
      services: { eyebrow: "Servicios", title: "Servicios turísticos con asesoría personalizada", description: "Elige el tipo de apoyo que necesitas: hospedaje, paquetes, tours, traslados, casas o asesoría para ordenar ideas.", note: "Cada servicio se cotiza según fechas, destino, viajeros y condiciones del proveedor.", ctaTitle: "¿No sabes por dónde empezar?", ctaText: "Comparte tu idea y te ayudamos a elegir qué servicio conviene primero.", ctaTopic: "servicios turísticos" },
      packages: { eyebrow: "Paquetes", title: "Paquetes para distintos estilos de viaje", description: "No manejamos paquetes rígidos como SKU fijo: armamos combinaciones según familia, pareja o grupo, con tiempos y presupuesto realistas.", note: "Hotel, traslados, tours y extras se confirman antes de apartar; disponibilidad no es en tiempo real.", ctaTitle: "Armemos un paquete con sentido", ctaText: "Cuéntanos quién viaja, fechas y presupuesto para preparar una ruta clara.", ctaTopic: "paquete vacacional" },
      deals: { eyebrow: "Promociones muestra", title: "Promociones y viajes sugeridos", description: "Estas ideas sirven para iniciar conversación y entender rango de presupuesto. La tarifa final depende de fechas, hotel, impuestos y disponibilidad validada.", note: "Las promociones no reservan inventario ni garantizan precio hasta revisión manual.", ctaTitle: "Validemos una promoción", ctaText: "Envíanos la idea que te gustó y revisamos opciones reales para tus fechas.", ctaTopic: "promociones disponibles" },
      destinations: { eyebrow: "Destinos", title: "Destinos para empezar tu plan", description: "Compara bases de viaje según ambiente, movilidad, tours cercanos y tipo de hospedaje para decidir mejor.", note: "Los precios desde son informativos y cambian por temporada, zona, ocupación y proveedor.", ctaTitle: "Elige base con ayuda", ctaText: "Si dudas entre destinos, te orientamos por estilo de viaje, presupuesto y logística.", ctaTopic: "elegir destino" },
    } satisfies Record<ListingKind, ListingCopy>,
    servicesTitle: "Servicios turísticos con asesoría personalizada",
    packagesTitle: "Paquetes para distintos estilos de viaje",
    dealsTitle: "Promociones y viajes sugeridos",
    destinationsTitle: "Destinos para empezar tu plan",
    aboutTitle: "Nosotros",
    aboutText: "AC Travel Mx nace para ayudar a viajeros a tomar mejores decisiones con una atención cercana, clara y humana. Nuestro enfoque combina inspiración, asesoría y seguimiento para que cada viaje sume experiencias y sueños.",
    contactTitle: "Contacto",
    contactText: "Escríbenos por WhatsApp para una respuesta más ágil. También podemos orientar tu solicitud si todavía estás explorando fechas o presupuesto.",
    quoteTitle: "Cotizar viaje",
    quoteText: "Cuéntanos fechas, viajeros y presupuesto. Guardaremos tu solicitud para que una asesora te contacte por WhatsApp con opciones claras.",
    quoteForm: {
      eyebrow: "Formulario de cotización",
      title: "Recibe una propuesta personalizada",
      description: "La atención sigue siendo WhatsApp-first: el formulario nos ayuda a preparar mejor la conversación y no confirma disponibilidad ni compra automática.",
      requiredMarker: "Obligatorio",
      optionalMarker: "Opcional",
      submit: "Enviar solicitud",
      submitting: "Enviando...",
      successTitle: "Solicitud recibida",
      successNextStep: "Una asesora revisará tus datos y continuará por WhatsApp o correo con opciones y preguntas puntuales.",
      successDisclaimer: "Esto no confirma disponibilidad, precio final ni compra automática; primero validamos condiciones con proveedores.",
      successWhatsAppHelp: "Puedes acelerar la conversación continuando con el mensaje preparado.",
      failureTitle: "No se pudo enviar",
      failureRecovery: "Revisa los campos marcados. Si el problema continúa o aparece límite de intentos, intenta más tarde o continúa por WhatsApp.",
      whatsappCta: "Continuar por WhatsApp",
      reset: "Enviar otra solicitud",
      sections: {
        contact: { title: "1. Datos de contacto", description: "Necesitamos correo y WhatsApp para dar seguimiento sin perder tu solicitud." },
        trip: { title: "2. Datos básicos del viaje", description: "Fechas, destino y presupuesto pueden ser aproximados; los afinamos contigo después." },
        context: { title: "3. Contexto para cotizar", description: "Elige el servicio más cercano y agrega notas solo si ayudan a entender tu viaje." },
      },
      fields: {
        holderName: "Nombre completo",
        email: "Correo electrónico",
        whatsapp: "WhatsApp",
        origin: "Ciudad de origen",
        mainDestination: "Destino principal",
        departureDate: "Fecha de salida",
        returnDate: "Fecha de regreso",
        adults: "Adultos",
        children: "Menores",
        serviceInterest: "Servicio de interés",
        approximateBudget: "Presupuesto aproximado",
        sourceChannel: "¿Cómo nos encontraste?",
        preferredCurrency: "Moneda preferida",
        notes: "Notas adicionales (opcional)",
        contactConsent: "Acepto que AC Travel Mx me contacte por WhatsApp y/o correo para atender esta solicitud.",
      },
      placeholders: {
        holderName: "Ej. Ana López",
        email: "ana@email.com",
        whatsapp: "+52 998 123 4567",
        origin: "Ej. CDMX",
        mainDestination: "Ej. Cancún",
        sourceChannel: "Ej. Instagram, Google o campaña",
        budget: "Ej. 25000",
        notes: "Hotel, estilo de viaje, edades de menores o detalles importantes.",
      },
      hints: {
        holderName: "Como aparece mejor para contactarte.",
        email: "Lo usamos para confirmar que recibimos tu solicitud y enviar seguimiento si hace falta.",
        whatsapp: "Incluye lada para contactarte más rápido.",
        origin: "Ciudad o aeropuerto desde donde planeas salir.",
        mainDestination: "Puedes cambiarlo si vienes desde una promoción o destino prellenado.",
        departureDate: "Si todavía no es final, elige la fecha tentativa más cercana.",
        returnDate: "Puede ser tentativa; validaremos noches y disponibilidad después.",
        travelers: "Si viajan menores, agrega edades en notas para cotizar mejor.",
        serviceInterest: "Elige la opción más cercana aunque después ajustemos el alcance.",
        approximateBudget: "Un rango aproximado ayuda a filtrar opciones realistas.",
        sourceChannel: "Nos ayuda a entender el contexto de tu solicitud.",
        notes: "Opcional: estilo de hotel, edades de menores, celebración o necesidades especiales.",
        contactConsent: "Sin este permiso no podemos dar seguimiento a la cotización.",
      },
      serviceOptions: ["Paquete hotel + traslados", "Hotel o resort", "Tours y experiencias", "Traslados", "Casa vacacional", "Asesoría personalizada"],
      sourceOptions: ["WhatsApp", "Instagram", "Facebook", "Google", "Recomendación", "Sitio web"],
    },
    legalProvisional: "Contenido provisional: esta página es una base informativa pendiente de revisión legal y operativa final.",
    legal: {
      privacy: ["Aviso de privacidad", "Explica de forma preliminar que los datos compartidos por WhatsApp o futuros formularios se usarán para atender solicitudes de viaje. No representa aviso legal definitivo."],
      terms: ["Términos y condiciones", "Base provisional sobre el uso del sitio, la naturaleza informativa de precios desde/consultar y la confirmación manual de servicios."],
      payments: ["Pagos y cancelaciones", "Guía provisional: políticas finales dependerán del proveedor, tarifa, fecha y condiciones confirmadas al cotizar."],
    },
  },
  en: {
    heroKicker: "Travel agency in Mexico",
    homeTitle: "Mexico and Caribbean trips with human WhatsApp advisory.",
    homeDescription: "We help you compare destinations, hotels, transfers, and experiences to build a clear proposal. There is no automatic checkout: first we understand your trip and validate availability.",
    heroSupport: ["Cancun, Riviera Maya, Playa del Carmen, and more", "Options by budget, style, and dates", "Human follow-up before confirmation"],
    primaryCta: "Quote on WhatsApp",
    quoteCta: "Prepare my quote",
    viewDeals: "View deals",
    sections: {
      benefits: ["Travel with more clarity", "Before choosing a hotel or tour, we align budget, dates, area, and conditions so you avoid blind decisions."],
      destinations: ["Featured destinations", "Choose a base and we build the rest with you."],
      deals: ["Sample deals", "Travel ideas to start a conversation; final availability is confirmed by an advisor."],
      services: ["Services", "Everything you need to plan better and travel with confidence."],
      process: ["How it works", "No automatic checkout: we listen first, then propose."],
      trust: ["Why AC Travel", "Close support, clear options, and a human-centered approach."],
      faq: ["Frequently asked questions", "Quick answers before requesting a quote."],
    },
    benefits: [
      { title: "Organized options", text: "We filter areas, hotels, and experiences so you compare less noise and better alternatives.", eyebrow: "Clarity" },
      { title: "Realistic budget", text: "We use from or check-availability prices as a starting point and validate conditions before confirmation.", eyebrow: "No false promises" },
      { title: "Coordinated trip", text: "We can connect hotel, transfers, tours, and extras so the itinerary is practical.", eyebrow: "Logistics" },
      { title: "Human support", text: "WhatsApp remains the main channel to answer questions and adjust the proposal.", eyebrow: "Care" },
    ],
    process: ["Share destination, dates, travelers, origin, and approximate budget.", "An advisor compares options, availability, and supplier conditions.", "You receive a clear proposal and decide whether to continue with human follow-up."],
    trust: ["WhatsApp as the main channel", "From or check-availability rates, always validated", "Manual availability: no real-time inventory promises"],
    faq: [
      { question: "Are published prices final?", answer: "No. They are from-price references or check-availability ideas. Taxes, final hotel, dates, and conditions are manually validated before confirmation." },
      { question: "How do you confirm availability?", answer: "After receiving your context, we review options with suppliers or operational sources and explain what is available and under which conditions." },
      { question: "What do I need to request a quote?", answer: "Destination, origin city, tentative dates, number of travelers, children ages, budget, and travel style. The form helps prepare a better WhatsApp conversation." },
      { question: "Do WhatsApp and the form work together?", answer: "Yes. WhatsApp is the main channel and the form saves your request so an advisor can respond with more context." },
      { question: "Do payments and cancellations depend on AC Travel?", answer: "They depend on supplier, fare, date, and confirmed conditions. See the payments and cancellations page for the provisional guide." },
    ],
    finalCta: { title: "Your trip starts with a clear conversation.", text: "Tell us what you have in mind and an advisor will guide you with realistic options before you buy.", whatsappTopic: "my next trip", quoteLabel: "Send trip details" },
    listingPages: {
      services: { eyebrow: "Services", title: "Travel services with personalized advisory", description: "Choose the support you need: stays, packages, tours, transfers, homes, or advisory to organize ideas.", note: "Each service is quoted according to dates, destination, travelers, and supplier conditions.", ctaTitle: "Not sure where to start?", ctaText: "Share your idea and we will help you choose which service to prioritize first.", ctaTopic: "travel services" },
      packages: { eyebrow: "Packages", title: "Packages for different travel styles", description: "We do not treat packages as fixed SKUs: we build combinations for families, couples, or groups with realistic timing and budget.", note: "Hotel, transfers, tours, and extras are confirmed before holding anything; availability is not real time.", ctaTitle: "Let's build a package that makes sense", ctaText: "Tell us who is traveling, dates, and budget so we can prepare a clear route.", ctaTopic: "vacation package" },
      deals: { eyebrow: "Sample deals", title: "Deals and suggested trips", description: "These ideas start the conversation and help estimate budget range. Final rates depend on dates, hotel, taxes, and validated availability.", note: "Deals do not reserve inventory or guarantee price until manual review.", ctaTitle: "Let's validate a deal", ctaText: "Send us the idea you liked and we will review real options for your dates.", ctaTopic: "available deals" },
      destinations: { eyebrow: "Destinations", title: "Destinations to start your plan", description: "Compare travel bases by vibe, mobility, nearby tours, and lodging style so you can choose better.", note: "From prices are informational and change by season, area, occupancy, and supplier.", ctaTitle: "Choose a base with help", ctaText: "If you are deciding between destinations, we can guide you by travel style, budget, and logistics.", ctaTopic: "choosing a destination" },
    } satisfies Record<ListingKind, ListingCopy>,
    servicesTitle: "Travel services with personalized advisory",
    packagesTitle: "Packages for different travel styles",
    dealsTitle: "Deals and suggested trips",
    destinationsTitle: "Destinations to start your plan",
    aboutTitle: "About us",
    aboutText: "AC Travel Mx helps travelers make better decisions through close, clear, human support. Our approach combines inspiration, advisory, and follow-up so every trip adds experiences and dreams.",
    contactTitle: "Contact",
    contactText: "Message us on WhatsApp for the fastest response. We can also guide your request if you are still exploring dates or budget.",
    quoteTitle: "Quote a trip",
    quoteText: "Share dates, travelers, and budget. We will save your request so an advisor can contact you on WhatsApp with clear options.",
    quoteForm: {
      eyebrow: "Quote form",
      title: "Get a personalized proposal",
      description: "We remain WhatsApp-first: this form helps us prepare a better conversation and does not confirm availability or automatic purchase.",
      requiredMarker: "Required",
      optionalMarker: "Optional",
      submit: "Send request",
      submitting: "Sending...",
      successTitle: "Request received",
      successNextStep: "An advisor will review your details and continue by WhatsApp or email with options and focused questions.",
      successDisclaimer: "This does not confirm availability, final price, or automatic purchase; we first validate supplier conditions.",
      successWhatsAppHelp: "You can speed up the conversation by continuing with the prepared message.",
      failureTitle: "Could not send",
      failureRecovery: "Review the highlighted fields. If the problem continues or you hit the request limit, try again later or continue on WhatsApp.",
      whatsappCta: "Continue on WhatsApp",
      reset: "Send another request",
      sections: {
        contact: { title: "1. Contact details", description: "We need email and WhatsApp to follow up without losing your request." },
        trip: { title: "2. Trip basics", description: "Dates, destination, and budget can be approximate; we will refine them with you." },
        context: { title: "3. Quote context", description: "Choose the closest service and add notes only if they help explain your trip." },
      },
      fields: {
        holderName: "Full name",
        email: "Email",
        whatsapp: "WhatsApp",
        origin: "Origin city",
        mainDestination: "Main destination",
        departureDate: "Departure date",
        returnDate: "Return date",
        adults: "Adults",
        children: "Children",
        serviceInterest: "Service interest",
        approximateBudget: "Approximate budget",
        sourceChannel: "How did you find us?",
        preferredCurrency: "Preferred currency",
        notes: "Additional notes (optional)",
        contactConsent: "I agree that AC Travel Mx may contact me by WhatsApp and/or email about this request.",
      },
      placeholders: {
        holderName: "E.g. Anna Smith",
        email: "anna@email.com",
        whatsapp: "+1 555 123 4567",
        origin: "E.g. Dallas",
        mainDestination: "E.g. Cancun",
        sourceChannel: "E.g. Instagram, Google, or campaign",
        budget: "E.g. 1500",
        notes: "Hotel style, traveler ages, trip vibe, or important details.",
      },
      hints: {
        holderName: "How you prefer us to address you.",
        email: "We use it to confirm receipt and send follow-up if needed.",
        whatsapp: "Include country code so we can contact you faster.",
        origin: "City or airport where you plan to start.",
        mainDestination: "You can edit this if it was prefilled from a deal or destination.",
        departureDate: "If it is not final, choose your closest tentative date.",
        returnDate: "Tentative is fine; we will validate nights and availability later.",
        travelers: "If children are traveling, add ages in notes for a better quote.",
        serviceInterest: "Choose the closest option even if we refine scope later.",
        approximateBudget: "A rough range helps us filter realistic options.",
        sourceChannel: "This helps us understand the context for your request.",
        notes: "Optional: hotel style, children ages, celebration, or special needs.",
        contactConsent: "Without this permission we cannot follow up on the quote.",
      },
      serviceOptions: ["Hotel + transfer package", "Hotel or resort", "Tours and experiences", "Transfers", "Vacation home", "Personalized advisory"],
      sourceOptions: ["WhatsApp", "Instagram", "Facebook", "Google", "Referral", "Website"],
    },
    legalProvisional: "Provisional content: this page is an informational baseline pending final legal and operational review.",
    legal: {
      privacy: ["Privacy notice", "Preliminarily explains that data shared by WhatsApp or future forms will be used to handle travel requests. It is not a final legal notice."],
      terms: ["Terms and conditions", "Provisional baseline about website use, informational from/check-availability prices, and manual service confirmation."],
      payments: ["Payments and cancellations", "Provisional guide: final policies depend on supplier, fare, date, and confirmed quote conditions."],
    },
  },
} as const;
