export const META_ATTRIBUTION_STORAGE_KEY = "ac-travel-meta-attribution";

const MAX_ATTRIBUTION_VALUE_LENGTH = 512;
const MAX_ATTRIBUTION_JSON_LENGTH = 4000;

export type MetaAttribution = {
  capturedAt: string;
  landingPath: string;
  landingUrl: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  fbclid?: string;
  fbp?: string;
  fbc?: string;
};

type BuildMetaAttributionInput = {
  pathname: string;
  href: string;
  referrer?: string;
  searchParams: URLSearchParams;
  cookie: string;
  now?: Date;
  existing?: MetaAttribution | null;
};

function clampAttributionValue(value?: string | null, maxLength = MAX_ATTRIBUTION_VALUE_LENGTH) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readCookieValue(cookieHeader: string, name: string) {
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  const rawValue = cookie?.slice(name.length + 1);
  if (!rawValue) return undefined;

  try {
    return clampAttributionValue(decodeURIComponent(rawValue));
  } catch {
    return clampAttributionValue(rawValue);
  }
}

export function buildMetaFbc(fbclid?: string, now = new Date()) {
  const safeFbclid = clampAttributionValue(fbclid);
  if (!safeFbclid) return undefined;
  return `fb.1.${now.getTime()}.${safeFbclid}`;
}

export function sanitizeMetaAttribution(value: unknown): MetaAttribution | undefined {
  if (!isRecord(value)) return undefined;

  const capturedAt = clampAttributionValue(typeof value.capturedAt === "string" ? value.capturedAt : undefined, 64);
  const landingPath = clampAttributionValue(typeof value.landingPath === "string" ? value.landingPath : undefined);
  const landingUrl = clampAttributionValue(typeof value.landingUrl === "string" ? value.landingUrl : undefined);

  if (!capturedAt || !landingPath || !landingUrl) return undefined;

  const sanitized: MetaAttribution = {
    capturedAt,
    landingPath,
    landingUrl,
  };

  for (const [key, source] of Object.entries({
    referrer: value.referrer,
    utmSource: value.utmSource,
    utmMedium: value.utmMedium,
    utmCampaign: value.utmCampaign,
    utmTerm: value.utmTerm,
    utmContent: value.utmContent,
    fbclid: value.fbclid,
    fbp: value.fbp,
    fbc: value.fbc,
  })) {
    const sanitizedValue = clampAttributionValue(typeof source === "string" ? source : undefined);
    if (sanitizedValue) {
      sanitized[key as keyof Omit<MetaAttribution, "capturedAt" | "landingPath" | "landingUrl">] = sanitizedValue;
    }
  }

  return sanitized;
}

export function parseMetaAttributionSnapshot(snapshot?: string | null) {
  const safeSnapshot = clampAttributionValue(snapshot, MAX_ATTRIBUTION_JSON_LENGTH);
  if (!safeSnapshot) return undefined;

  try {
    return sanitizeMetaAttribution(JSON.parse(safeSnapshot));
  } catch {
    return undefined;
  }
}

export function buildMetaAttribution({ pathname, href, referrer, searchParams, cookie, now = new Date(), existing }: BuildMetaAttributionInput) {
  const current = sanitizeMetaAttribution({
    capturedAt: now.toISOString(),
    landingPath: pathname,
    landingUrl: href,
    referrer,
    utmSource: searchParams.get("utm_source"),
    utmMedium: searchParams.get("utm_medium"),
    utmCampaign: searchParams.get("utm_campaign"),
    utmTerm: searchParams.get("utm_term"),
    utmContent: searchParams.get("utm_content"),
    fbclid: searchParams.get("fbclid"),
    fbp: readCookieValue(cookie, "_fbp"),
    fbc: readCookieValue(cookie, "_fbc") ?? buildMetaFbc(searchParams.get("fbclid") ?? undefined, now),
  });

  if (!current) return existing ?? undefined;
  if (!existing) return current;

  return sanitizeMetaAttribution({
    capturedAt: existing.capturedAt,
    landingPath: existing.landingPath,
    landingUrl: existing.landingUrl,
    referrer: existing.referrer ?? current.referrer,
    utmSource: existing.utmSource ?? current.utmSource,
    utmMedium: existing.utmMedium ?? current.utmMedium,
    utmCampaign: existing.utmCampaign ?? current.utmCampaign,
    utmTerm: existing.utmTerm ?? current.utmTerm,
    utmContent: existing.utmContent ?? current.utmContent,
    fbclid: existing.fbclid ?? current.fbclid,
    fbp: existing.fbp ?? current.fbp,
    fbc: existing.fbc ?? current.fbc,
  });
}
