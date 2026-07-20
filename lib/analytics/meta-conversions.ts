import "server-only";

import { createHash } from "node:crypto";
import { areExternalBoundariesDisabled, externalBoundarySkipReason } from "@/lib/runtime/external-boundaries";
import { parseMetaAttributionSnapshot } from "@/lib/analytics/meta-attribution";
import { normalizeEmail, normalizeWhatsApp, type QuoteRequestInput } from "@/lib/validations/quote-request";

type MetaConversionsContext = {
  createdAt: string;
  eventId?: string;
  eventSourceUrl?: string;
  leadId: string;
  requestIp?: string | null;
  userAgent?: string | null;
};

type MetaConversionsSummary = {
  kind: "meta_conversions_api";
  status: "sent" | "skipped" | "failed";
  reason?: string;
};

function sha256(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  return createHash("sha256").update(normalized).digest("hex");
}

export function getMetaConversionsConfig() {
  return {
    pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "",
    accessToken: process.env.META_CONVERSIONS_API_ACCESS_TOKEN?.trim() ?? "",
    testEventCode: process.env.META_CONVERSIONS_TEST_EVENT_CODE?.trim() ?? "",
  };
}

export function isMetaConversionsEnabled() {
  const config = getMetaConversionsConfig();
  return config.pixelId.length > 0 && config.accessToken.length > 0;
}

export function buildMetaLeadEventPayload(input: QuoteRequestInput, context: MetaConversionsContext) {
  const attribution = parseMetaAttributionSnapshot(input.attributionSnapshot);
  const eventSourceUrl = context.eventSourceUrl;

  return {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(new Date(context.createdAt).getTime() / 1000),
        event_id: context.eventId,
        action_source: "website",
        event_source_url: eventSourceUrl,
        user_data: {
          em: sha256(normalizeEmail(input.email)),
          ph: sha256(normalizeWhatsApp(input.whatsapp)),
          external_id: sha256(`${context.leadId}:${normalizeWhatsApp(input.whatsapp)}`),
          client_ip_address: context.requestIp ?? undefined,
          client_user_agent: context.userAgent ?? undefined,
        },
        custom_data: {
          currency: input.preferredCurrency,
          value: input.approximateBudget,
          content_name: input.mainDestination,
          content_category: input.serviceInterest,
          source_channel: input.sourceChannel,
          campaign_context: input.campaignContext,
          client_utm_source: attribution?.utmSource,
          client_utm_medium: attribution?.utmMedium,
          client_utm_campaign: attribution?.utmCampaign,
        },
      },
    ],
  };
}

export async function sendMetaLeadEvent(input: QuoteRequestInput, context: MetaConversionsContext): Promise<MetaConversionsSummary> {
  if (areExternalBoundariesDisabled()) {
    return { kind: "meta_conversions_api", status: "skipped", reason: externalBoundarySkipReason("meta_conversions") };
  }

  if (!isMetaConversionsEnabled()) {
    return { kind: "meta_conversions_api", status: "skipped", reason: "Meta Pixel ID or Conversions API token is missing" };
  }

  const config = getMetaConversionsConfig();
  const payload = buildMetaLeadEventPayload(input, context);
  const url = new URL(`https://graph.facebook.com/v23.0/${config.pixelId}/events`);
  url.searchParams.set("access_token", config.accessToken);
  if (config.testEventCode) {
    url.searchParams.set("test_event_code", config.testEventCode);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      kind: "meta_conversions_api",
      status: "failed",
      reason: `Meta CAPI ${response.status}: ${text.slice(0, 240)}`,
    };
  }

  return { kind: "meta_conversions_api", status: "sent" };
}
