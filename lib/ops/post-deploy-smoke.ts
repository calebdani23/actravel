import robots from "@/app/robots";
import { renderQuoteEmail } from "@/lib/email/templates/quote-request";
import { buildQuoteNotificationPlans } from "@/lib/leads/quote-notification-core";
import { buildTrustedQuoteAttribution } from "@/lib/leads/quote-request-service";
import { absoluteUrl } from "@/lib/seo/public-seo";
import type { QuoteRequestInput } from "@/lib/validations/quote-request";
import { buildAbsoluteTrackedWhatsAppUrl } from "@/lib/whatsapp/link";

const brandLogoPath = "/brand/ac-travel-logo-original-500x135.png";

export type PostDeploySmokeResult = {
  checkedUrlCount: number;
  emailAdminAddress: string;
  emailFromAddress: string;
  expectedSiteUrl: string;
};

const sampleInput: QuoteRequestInput = {
  locale: "en",
  preferredCurrency: "USD",
  holderName: "Ada Lovelace",
  email: "ada@example.com",
  whatsapp: "+1 555 100 2000",
  origin: "Cancun",
  mainDestination: "Riviera Maya",
  departureDate: "2026-07-01",
  returnDate: "2026-07-07",
  adults: 2,
  children: 1,
  serviceInterest: "Family package",
  approximateBudget: 3500,
  sourceChannel: "website_quote",
  contactConsent: true,
  notes: "Need vegan options",
  website: "",
};

function parseRequiredSiteUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return { ok: false as const, reason: "NEXT_PUBLIC_SITE_URL is missing" };

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false as const, reason: "NEXT_PUBLIC_SITE_URL must use http or https" };
    }
    if (url.pathname !== "/" || url.search || url.hash) {
      return { ok: false as const, reason: "NEXT_PUBLIC_SITE_URL must be a clean site origin without path, query, or hash" };
    }
    return { ok: true as const, url };
  } catch {
    return { ok: false as const, reason: "NEXT_PUBLIC_SITE_URL is not a valid URL" };
  }
}

function parseEmailAddress(value: string | undefined, envName: "EMAIL_FROM" | "EMAIL_ADMIN") {
  const trimmed = value?.trim();
  if (!trimmed) return { ok: false as const, reason: `${envName} is missing` };

  const bracketMatch = trimmed.match(/<([^<>\s]+@[^<>\s]+)>/);
  const candidate = bracketMatch?.[1] ?? trimmed;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
    return { ok: false as const, reason: `${envName} must contain a valid email address` };
  }

  return { ok: true as const, address: candidate };
}

function assertStartsWith(value: string, prefix: string, message: string, errors: string[]) {
  if (!value.startsWith(prefix)) errors.push(`${message}: expected prefix ${prefix}, received ${value}`);
}

export async function runPostDeploySmokeCheck(): Promise<PostDeploySmokeResult> {
  const errors: string[] = [];
  const siteUrl = parseRequiredSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const emailFrom = parseEmailAddress(process.env.EMAIL_FROM, "EMAIL_FROM");
  const emailAdmin = parseEmailAddress(process.env.EMAIL_ADMIN, "EMAIL_ADMIN");

  if (!siteUrl.ok) errors.push(siteUrl.reason);
  if (!emailFrom.ok) errors.push(emailFrom.reason);
  if (!emailAdmin.ok) errors.push(emailAdmin.reason);

  if (errors.length > 0) throw new Error(errors.join("\n"));

  const expectedSiteUrl = siteUrl.url.toString().replace(/\/$/, "");
  const expectedTrackedHref = buildAbsoluteTrackedWhatsAppUrl({
    message: "Hello AC Travel",
    phone: "529988453455",
    locale: sampleInput.locale,
    pagePath: "quote-confirmation",
    leadId: "12345678-1234-4234-9234-123456789abc",
    contactId: "12345678-1234-4234-9234-123456789abd",
  });
  const seoUrlsToCheck = [
    absoluteUrl("/es"),
    absoluteUrl("/en/quote"),
    absoluteUrl("/sitemap.xml"),
  ];

  assertStartsWith(seoUrlsToCheck[0], `${expectedSiteUrl}/es`, "Public SEO home URL is inconsistent", errors);
  assertStartsWith(seoUrlsToCheck[1], `${expectedSiteUrl}/en/quote`, "Public SEO quote URL is inconsistent", errors);
  assertStartsWith(seoUrlsToCheck[2], `${expectedSiteUrl}/sitemap.xml`, "Public sitemap URL is inconsistent", errors);

  const robotsMetadata = robots();
  if (robotsMetadata.sitemap !== `${expectedSiteUrl}/sitemap.xml`) {
    errors.push(`robots sitemap is inconsistent: expected ${expectedSiteUrl}/sitemap.xml, received ${robotsMetadata.sitemap}`);
  }

  const clientEmail = renderQuoteEmail({
    templateName: "client_quote_request_confirmation",
    input: sampleInput,
    leadId: "12345678-abcd",
    quoteRequestId: "quote-1",
    normalizedEmail: sampleInput.email,
    adminWhatsAppHref: "https://wa.me/15551002000",
    clientWhatsAppHref: expectedTrackedHref,
  });

  if (!clientEmail.html.includes(`src="${expectedSiteUrl}${brandLogoPath}"`)) {
    errors.push("Client email logo asset URL is inconsistent with NEXT_PUBLIC_SITE_URL");
  }
  if (!clientEmail.html.includes(`${expectedSiteUrl}/api/whatsapp-click?`)) {
    errors.push("Client email WhatsApp CTA URL is inconsistent with NEXT_PUBLIC_SITE_URL");
  }
  if (!clientEmail.text.includes(expectedTrackedHref)) {
    errors.push("Client email text CTA URL is inconsistent with NEXT_PUBLIC_SITE_URL");
  }

  assertStartsWith(expectedTrackedHref, `${expectedSiteUrl}/api/whatsapp-click?`, "Absolute tracked WhatsApp URL is inconsistent", errors);

  const attribution = buildTrustedQuoteAttribution(sampleInput, { requestReferrer: "https://www.google.com/travel" });
  if (attribution.quotePageUrl !== `${expectedSiteUrl}/en/quote`) {
    errors.push(`Quote attribution page URL is inconsistent: expected ${expectedSiteUrl}/en/quote, received ${attribution.quotePageUrl ?? "undefined"}`);
  }

  const [adminPlan] = buildQuoteNotificationPlans(sampleInput, sampleInput.email);
  if (adminPlan.recipient !== process.env.EMAIL_ADMIN) {
    errors.push(`Admin quote notification recipient is inconsistent: expected ${process.env.EMAIL_ADMIN}, received ${adminPlan.recipient ?? "null"}`);
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));

  return {
    checkedUrlCount: seoUrlsToCheck.length + 1,
    emailAdminAddress: emailAdmin.address,
    emailFromAddress: emailFrom.address,
    expectedSiteUrl,
  };
}
