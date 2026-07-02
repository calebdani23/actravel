import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createLeadIntake } from "@/lib/leads/lead-intake-core";
import { boundText, extractInboundMessages, hasReferralContext, matchesInboundTrigger, type ExtractedInboundMessage } from "@/lib/leads/whatsapp-inbound";
import type { Json } from "@/lib/supabase/database.types";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type InboundStatus = "lead_created" | "duplicate" | "ignored_non_text" | "ignored_trigger_mismatch" | "ignored_no_referral" | "failed";

type ServiceDependencies = {
  createSupabaseClient: () => SupabaseAdminClient;
  now: () => string;
};

let dependencies: ServiceDependencies = {
  createSupabaseClient: createSupabaseAdminClient,
  now: () => new Date().toISOString(),
};

export function setWhatsappInboundDependenciesForTests(next: Partial<ServiceDependencies> | null) {
  dependencies = next ? { ...dependencies, ...next } : { createSupabaseClient: createSupabaseAdminClient, now: () => new Date().toISOString() };
}

function sourceFromReferral(referral: Record<string, Json>) {
  const raw = typeof referral.source_type === "string" ? referral.source_type.toLowerCase() : "";
  if (raw.includes("instagram")) return "whatsapp_inbound_instagram";
  if (raw.includes("facebook")) return "whatsapp_inbound_facebook";
  return "whatsapp_inbound_ad";
}

function buildLeadSummary(message: ExtractedInboundMessage) {
  const identity = message.profileName || message.fromPhone || message.waId;
  const headline = typeof message.referral.headline === "string" ? message.referral.headline : typeof message.referral.source_type === "string" ? message.referral.source_type : null;
  return `WhatsApp ad lead · ${identity}${headline ? ` · ${headline}` : ""}`;
}

async function insertInboundMessageRow(supabase: SupabaseAdminClient, message: ExtractedInboundMessage) {
  return supabase.from("whatsapp_inbound_messages").insert({
    meta_message_id: message.metaMessageId,
    phone_number_id: message.phoneNumberId,
    wa_id: message.waId,
    from_phone: message.fromPhone,
    profile_name: message.profileName,
    message_type: message.messageType,
    message_text: message.messageText,
    normalized_text: message.normalizedText,
    referral: message.referral,
    raw_payload: message.rawPayload,
    processing_status: "received",
    received_at: message.receivedAt,
  }).select("id").single();
}

async function updateInboundMessageRow(supabase: SupabaseAdminClient, metaMessageId: string, update: Record<string, unknown>) {
  const { error } = await supabase.from("whatsapp_inbound_messages").update(update).eq("meta_message_id", metaMessageId);
  if (error) throw error;
}

async function markIgnored(supabase: SupabaseAdminClient, message: ExtractedInboundMessage, processingStatus: Extract<InboundStatus, "ignored_non_text" | "ignored_trigger_mismatch" | "ignored_no_referral">, ignoredReason: string) {
  await updateInboundMessageRow(supabase, message.metaMessageId, {
    processing_status: processingStatus,
    ignored_reason: boundText(ignoredReason, 180),
    processed_at: dependencies.now(),
  });
}

export async function processWhatsAppWebhookPayload(payload: unknown, env: { phoneNumberId: string }) {
  const supabase = dependencies.createSupabaseClient();
  const messages = extractInboundMessages(payload, env.phoneNumberId, dependencies.now());
  const results: Array<{ metaMessageId: string; status: InboundStatus }> = [];

  for (const message of messages) {
    const inserted = await insertInboundMessageRow(supabase, message);
    if (inserted.error) {
      if ((inserted.error as { code?: string }).code === "23505") {
        results.push({ metaMessageId: message.metaMessageId, status: "duplicate" });
        continue;
      }
      throw inserted.error;
    }

    if (message.messageType !== "text" || !message.messageText) {
      await markIgnored(supabase, message, "ignored_non_text", "Inbound message is not a supported text lead trigger");
      results.push({ metaMessageId: message.metaMessageId, status: "ignored_non_text" });
      continue;
    }

    if (!matchesInboundTrigger(message.messageText)) {
      await markIgnored(supabase, message, "ignored_trigger_mismatch", "Inbound text did not match configured trigger text");
      results.push({ metaMessageId: message.metaMessageId, status: "ignored_trigger_mismatch" });
      continue;
    }

    if (!hasReferralContext(message.referral)) {
      await markIgnored(supabase, message, "ignored_no_referral", "Inbound text matched trigger but had no referral metadata");
      results.push({ metaMessageId: message.metaMessageId, status: "ignored_no_referral" });
      continue;
    }

    try {
      const source = sourceFromReferral(message.referral);
      const intake = await createLeadIntake(supabase, {
        contact: {
          name: message.profileName,
          phone: message.fromPhone,
          preferredLocale: "es",
          source,
          consentMarketing: false,
        },
        lead: {
          assignedTo: null,
          source,
          summary: buildLeadSummary(message),
          travelersCount: 1,
          priority: "normal",
        },
        event: {
          actorId: null,
          eventType: "whatsapp_inbound_received",
          payload: {
            whatsappInboundMessageId: inserted.data?.id ?? null,
            metaMessageId: message.metaMessageId,
            messageText: message.messageText,
            normalizedText: message.normalizedText,
            waId: message.waId,
            fromPhone: message.fromPhone,
            profileName: message.profileName,
            source,
            referral: message.referral,
          },
        },
      });

      await updateInboundMessageRow(supabase, message.metaMessageId, {
        contact_id: intake.contactId,
        lead_id: intake.leadId,
        processing_status: "lead_created",
        processed_at: dependencies.now(),
      });
      results.push({ metaMessageId: message.metaMessageId, status: "lead_created" });
    } catch (error) {
      await updateInboundMessageRow(supabase, message.metaMessageId, {
        processing_status: "failed",
        error_message: boundText(error instanceof Error ? error.message : "WhatsApp inbound lead creation failed", 1000),
        processed_at: dependencies.now(),
      });
      results.push({ metaMessageId: message.metaMessageId, status: "failed" });
    }
  }

  return { ok: true, results };
}
