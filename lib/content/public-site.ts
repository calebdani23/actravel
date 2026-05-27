import { type Locale } from "@/lib/i18n/config";

type Localized = Record<Locale, string>;
export type PriceDisplay = { type: "from"; mxn?: number; usd?: number } | { type: "consult" };

export type PublicItem = {
  id: string;
  slug: Localized;
  title: Localized;
  summary: Localized;
  description: Localized;
  eyebrow?: Localized;
  highlights: Record<Locale, string[]>;
  price: PriceDisplay;
  featured?: boolean;
};

export type QuoteFormCopy = {
  eyebrow: string;
  title: string;
  description: string;
  submit: string;
  submitting: string;
  successTitle: string;
  failureTitle: string;
  whatsappCta: string;
  reset: string;
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
    price: { type: "from", mxn: 15400, usd: 890 },
  },
];

const services = [
  { id: "hotels", title: { es: "Hoteles y resorts", en: "Hotels and resorts" }, text: { es: "Opciones por zona, estilo de viaje y presupuesto.", en: "Options by area, travel style, and budget." } },
  { id: "packages", title: { es: "Paquetes vacacionales", en: "Vacation packages" }, text: { es: "Hotel, traslados, tours y extras coordinados.", en: "Hotel, transfers, tours, and extras coordinated." } },
  { id: "tours", title: { es: "Tours y experiencias", en: "Tours and experiences" }, text: { es: "Actividades seleccionadas para disfrutar sin improvisar.", en: "Selected activities so you can enjoy without improvising." } },
  { id: "transfers", title: { es: "Traslados", en: "Transfers" }, text: { es: "Privados o compartidos, según tu itinerario.", en: "Private or shared, depending on your itinerary." } },
  { id: "homes", title: { es: "Casas vacacionales", en: "Vacation homes" }, text: { es: "Alternativas para familias y grupos.", en: "Alternatives for families and groups." } },
  { id: "advisory", title: { es: "Asesoría personalizada", en: "Personalized advisory" }, text: { es: "Acompañamiento claro antes y durante tu compra.", en: "Clear guidance before and during your purchase." } },
];

const packages = [
  { title: { es: "Familia", en: "Family" }, text: { es: "Planes cómodos, seguros y con tiempos realistas.", en: "Comfortable, safe plans with realistic timing." } },
  { title: { es: "Pareja", en: "Couples" }, text: { es: "Escapadas románticas, aniversarios y luna de miel.", en: "Romantic escapes, anniversaries, and honeymoons." } },
  { title: { es: "Grupos", en: "Groups" }, text: { es: "Coordinación para amigos, empresas o celebraciones.", en: "Coordination for friends, companies, or celebrations." } },
];

export function getPublicSiteContent(locale: Locale) {
  const t = copy[locale];
  return { locale, routes: routeNames[locale], t, services, packages, destinations, promotions };
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
  const collection = section === routeNames[from].deals ? promotions : section === routeNames[from].destinations ? destinations : [];
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
    homeTitle: "Suma viajes, suma experiencias, suma sueños.",
    homeDescription: "Creamos propuestas claras para vacaciones en Cancún, Riviera Maya, Playa del Carmen y más, con atención humana por WhatsApp desde la primera idea.",
    primaryCta: "Cotizar por WhatsApp",
    quoteCta: "Preparar mi cotización",
    viewDeals: "Ver promociones",
    sections: {
      destinations: ["Destinos destacados", "Elige una base y armamos el resto contigo."],
      deals: ["Promociones muestra", "Ideas de viaje para iniciar conversación; disponibilidad final se confirma con una asesora."],
      services: ["Servicios", "Todo lo necesario para planear mejor y viajar con tranquilidad."],
      process: ["Cómo funciona", "Sin compra automática: primero escuchamos, luego proponemos."],
      trust: ["Por qué AC Travel", "Acompañamiento cercano, opciones claras y enfoque humano."],
    },
    process: ["Cuéntanos fechas, personas y presupuesto.", "Comparamos opciones reales y explicamos condiciones.", "Confirmas con asesoría humana y seguimiento."],
    trust: ["WhatsApp como canal principal", "Precios desde o bajo consulta", "Sin prometer inventario en tiempo real"],
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
      submit: "Enviar solicitud",
      submitting: "Enviando...",
      successTitle: "Solicitud recibida",
      failureTitle: "No se pudo enviar",
      whatsappCta: "Continuar por WhatsApp",
      reset: "Enviar otra solicitud",
      fields: {
        holderName: "Nombre completo",
        email: "Correo electrónico (opcional)",
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
        budget: "Ej. 25000",
        notes: "Hotel, estilo de viaje, edades de menores o detalles importantes.",
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
    homeTitle: "Add trips, add experiences, add dreams.",
    homeDescription: "We create clear vacation proposals for Cancun, Riviera Maya, Playa del Carmen, and more, with human WhatsApp support from the first idea.",
    primaryCta: "Quote on WhatsApp",
    quoteCta: "Prepare my quote",
    viewDeals: "View deals",
    sections: {
      destinations: ["Featured destinations", "Choose a base and we build the rest with you."],
      deals: ["Sample deals", "Travel ideas to start a conversation; final availability is confirmed by an advisor."],
      services: ["Services", "Everything you need to plan better and travel with confidence."],
      process: ["How it works", "No automatic checkout: we listen first, then propose."],
      trust: ["Why AC Travel", "Close support, clear options, and a human-centered approach."],
    },
    process: ["Tell us dates, travelers, and budget.", "We compare real options and explain conditions.", "You confirm with human advisory and follow-up."],
    trust: ["WhatsApp as the main channel", "From or check-availability pricing", "No real-time inventory promises"],
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
      submit: "Send request",
      submitting: "Sending...",
      successTitle: "Request received",
      failureTitle: "Could not send",
      whatsappCta: "Continue on WhatsApp",
      reset: "Send another request",
      fields: {
        holderName: "Full name",
        email: "Email (optional)",
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
        budget: "E.g. 1500",
        notes: "Hotel style, traveler ages, trip vibe, or important details.",
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
