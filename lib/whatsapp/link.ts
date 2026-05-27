const DEFAULT_PHONE = "529988453455";
const TRACKED_ENDPOINT = "/api/whatsapp-click";
const MAX_MESSAGE_LENGTH = 900;
const MAX_PAGE_PATH_LENGTH = 160;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WhatsAppLocale = "es" | "en";

export type TrackedWhatsAppLinkInput = Readonly<{
  message: string;
  phone?: string | null;
  locale?: string | null;
  pagePath?: string | null;
  leadId?: string | null;
  contactId?: string | null;
}>;

export function buildWhatsAppUrl(message: string, phone = process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? DEFAULT_PHONE) {
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${sanitizeWhatsAppPhone(phone) ?? DEFAULT_PHONE}?text=${encodedMessage}`;
}

export function sanitizeWhatsAppPhone(phone?: string | null) {
  const cleaned = (phone ?? process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? DEFAULT_PHONE).replace(/\D/g, "");
  if (cleaned.length < 8 || cleaned.length > 15) return null;
  return cleaned;
}

export function sanitizeWhatsAppMessage(message?: string | null) {
  const cleaned = (message ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_MESSAGE_LENGTH);
}

export function sanitizeWhatsAppLocale(locale?: string | null): WhatsAppLocale {
  return locale === "en" ? "en" : "es";
}

export function sanitizeWhatsAppPagePath(pagePath?: string | null) {
  const cleaned = (pagePath ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_PAGE_PATH_LENGTH);
  if (!cleaned) return null;
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://") || cleaned.startsWith("//")) return null;
  return cleaned.replace(/[^a-zA-Z0-9/_:?.=&%# -]/g, "").slice(0, MAX_PAGE_PATH_LENGTH) || null;
}

export function sanitizeWhatsAppUuid(value?: string | null) {
  const cleaned = (value ?? "").trim();
  return UUID_PATTERN.test(cleaned) ? cleaned : null;
}

export function buildTrackedWhatsAppUrl(input: TrackedWhatsAppLinkInput) {
  const message = sanitizeWhatsAppMessage(input.message) ?? "Hola AC Travel Mx, quisiera cotizar mi próximo viaje.";
  const params = new URLSearchParams({
    message,
    phone: sanitizeWhatsAppPhone(input.phone) ?? DEFAULT_PHONE,
    locale: sanitizeWhatsAppLocale(input.locale),
  });
  const pagePath = sanitizeWhatsAppPagePath(input.pagePath);
  const leadId = sanitizeWhatsAppUuid(input.leadId);
  const contactId = sanitizeWhatsAppUuid(input.contactId);

  if (pagePath) params.set("pagePath", pagePath);
  if (leadId) params.set("leadId", leadId);
  if (contactId) params.set("contactId", contactId);

  return `${TRACKED_ENDPOINT}?${params.toString()}`;
}
