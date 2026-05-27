export const locales = ["es", "en"] as const;
export type Locale = (typeof locales)[number];
export type Currency = "MXN" | "USD";

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

const dictionaries = {
  es: {
    routes: { promotions: "promociones", quote: "cotizar", contact: "contacto" },
    nav: {
      home: "Inicio",
      whatsapp: "Cotizar por WhatsApp",
      menu: "Menú",
      close: "Cerrar menú",
      items: [
        { href: "paquetes", label: "Paquetes" },
        { href: "promociones", label: "Promociones" },
        { href: "destinos", label: "Destinos" },
        { href: "servicios", label: "Servicios" },
        { href: "nosotros", label: "Nosotros" },
        { href: "cotizar", label: "Cotizar" },
      ],
    },
    controls: {
      languageLabel: "Idioma",
      currencyLabel: "Moneda",
      currencyHelper: "Preferencia visual",
    },
    home: {
      headline: "Suma viajes, suma experiencias, suma sueños.",
      description:
        "Planeamos contigo tus próximas vacaciones con atención personalizada, opciones claras y seguimiento humano de principio a fin.",
      primaryCta: "Cotizar por WhatsApp",
      secondaryCta: "Ver promociones",
      whatsappMessage: "Hola AC Travel Mx, quisiera cotizar mis próximas vacaciones.",
      placeholderCards: [
        { title: "Paquetes completos", description: "Base para presentar paquetes vacacionales con asesoría humana." },
        { title: "Destinos iniciales", description: "Cancún, Riviera Maya y Playa del Carmen preparados para futuras fichas." },
        { title: "Atención por WhatsApp", description: "CTA principal listo para llevar a conversación con AC Travel." },
      ],
    },
    footer: {
      tagline: "Suma viajes, suma experiencias, suma sueños.",
      description: "Agencia de viajes con atención personalizada para hoteles, tours, paquetes, traslados y casas vacacionales.",
      cta: "Escríbenos por WhatsApp",
      sections: "Secciones",
      contact: "Contacto",
      whatsapp: "+52 998 845 3455",
      rights: "Todos los derechos reservados.",
    },
    whatsapp: {
      floatingLabel: "Cotizar por WhatsApp",
      floatingShort: "WhatsApp",
    },
  },
  en: {
    routes: { promotions: "deals", quote: "quote", contact: "contact" },
    nav: {
      home: "Home",
      whatsapp: "Quote on WhatsApp",
      menu: "Menu",
      close: "Close menu",
      items: [
        { href: "packages", label: "Packages" },
        { href: "deals", label: "Deals" },
        { href: "destinations", label: "Destinations" },
        { href: "services", label: "Services" },
        { href: "about", label: "About" },
        { href: "quote", label: "Quote" },
      ],
    },
    controls: {
      languageLabel: "Language",
      currencyLabel: "Currency",
      currencyHelper: "Visual preference",
    },
    home: {
      headline: "Add trips, add experiences, add dreams.",
      description:
        "We help you plan your next vacation with personalized attention, clear options, and human support from start to finish.",
      primaryCta: "Quote on WhatsApp",
      secondaryCta: "View deals",
      whatsappMessage: "Hi AC Travel Mx, I would like to quote my next vacation.",
      placeholderCards: [
        { title: "Complete packages", description: "Base for vacation packages with human advisory support." },
        { title: "Initial destinations", description: "Cancun, Riviera Maya, and Playa del Carmen prepared for future pages." },
        { title: "WhatsApp attention", description: "Primary CTA ready to start a conversation with AC Travel." },
      ],
    },
    footer: {
      tagline: "Add trips, add experiences, add dreams.",
      description: "Travel agency with personalized support for hotels, tours, packages, transfers, and vacation homes.",
      cta: "Message us on WhatsApp",
      sections: "Sections",
      contact: "Contact",
      whatsapp: "+52 998 845 3455",
      rights: "All rights reserved.",
    },
    whatsapp: {
      floatingLabel: "Quote on WhatsApp",
      floatingShort: "WhatsApp",
    },
  },
} satisfies Record<Locale, unknown>;

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}
