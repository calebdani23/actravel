import { createHmac, timingSafeEqual } from "node:crypto";
import type { Json } from "@/lib/supabase/database.types";
import { normalizeWhatsApp } from "@/lib/validations/quote-request";

export type WhatsappReferral = Record<string, Json>;
export type ExtractedInboundMessage = {
  metaMessageId: string;
  phoneNumberId: string;
  waId: string;
  fromPhone: string;
  profileName: string | null;
  messageType: string;
  messageText: string | null;
  normalizedText: string | null;
  referral: WhatsappReferral;
  rawPayload: Json;
  receivedAt: string;
};

const DEFAULT_TRIGGER_TEXTS = ["!Hola! Quiero mas informacion."];
const MAX_PROFILE_NAME_LENGTH = 180;
const MAX_MESSAGE_TEXT_LENGTH = 4000;

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeInboundTriggerText(value: string) {
  return stripDiacritics(value)
    .replace(/[¡¿]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[.,;:!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function parseTriggerTexts(value = process.env.WHATSAPP_INBOUND_TRIGGER_TEXTS) {
  const candidates = value?.split(/[\n,|]/).map((item) => item.trim()).filter(Boolean) ?? [];
  const resolved = candidates.length ? candidates : DEFAULT_TRIGGER_TEXTS;
  return [...new Set(resolved.map(normalizeInboundTriggerText).filter(Boolean))];
}

export function matchesInboundTrigger(text: string, configured = parseTriggerTexts()) {
  return configured.includes(normalizeInboundTriggerText(text));
}

export function verifyMetaSignature(rawBody: string, signatureHeader: string | null | undefined, appSecret: string) {
  if (!signatureHeader) return false;
  const match = /^sha256=([a-f0-9]{64})$/i.exec(signatureHeader.trim());
  if (!match) return false;
  const expected = Buffer.from(createHmac("sha256", appSecret).update(rawBody).digest("hex"), "utf8");
  const received = Buffer.from(match[1].toLowerCase(), "utf8");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

export function hasReferralContext(referral: WhatsappReferral) {
  return Boolean(
    referral.source_id || referral.source_url || referral.source_type || referral.ctwa_clid || referral.headline || referral.body || referral.ad_id || referral.campaign_id,
  );
}

export function boundText(value: string | null | undefined, maxLength: number) {
  const text = value?.trim();
  return text ? text.slice(0, maxLength) : null;
}

export function boundJsonValue(value: unknown, maxBytes = Number(process.env.WHATSAPP_INBOUND_RAW_PAYLOAD_LIMIT_BYTES ?? process.env.WHATSAPP_INBOUND_RAW_PAYLOAD_MAX_BYTES ?? 12000)): Json {
  const serialized = JSON.stringify(value ?? {});
  if (Buffer.byteLength(serialized, "utf8") <= maxBytes) return JSON.parse(serialized) as Json;
  return {
    truncated: true,
    originalBytes: Buffer.byteLength(serialized, "utf8"),
    preview: serialized.slice(0, Math.max(0, maxBytes - 32)),
  } satisfies Json;
}

function referralObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, Json>;
}

function contactProfileName(changeValue: Record<string, unknown>, waId: string) {
  const contacts = Array.isArray(changeValue.contacts) ? changeValue.contacts as Array<Record<string, unknown>> : [];
  const matched = contacts.find((entry) => (typeof entry.wa_id === "string" ? entry.wa_id : null) === waId) ?? contacts[0];
  const profile = matched?.profile;
  if (!profile || typeof profile !== "object") return null;
  return boundText((profile as Record<string, unknown>).name as string | undefined, MAX_PROFILE_NAME_LENGTH);
}

export function extractInboundMessages(payload: unknown, phoneNumberId: string, now = new Date().toISOString()) {
  if (!payload || typeof payload !== "object") return [] as ExtractedInboundMessage[];
  const entry = Array.isArray((payload as Record<string, unknown>).entry) ? (payload as Record<string, unknown>).entry as Array<Record<string, unknown>> : [];
  const extracted: ExtractedInboundMessage[] = [];

  for (const entryItem of entry) {
    const changes = Array.isArray(entryItem.changes) ? entryItem.changes as Array<Record<string, unknown>> : [];
    for (const change of changes) {
      if (change.field !== "messages") continue;
      const value = change.value;
      if (!value || typeof value !== "object") continue;
      const changeValue = value as Record<string, unknown>;
      const metadata = changeValue.metadata;
      const currentPhoneNumberId = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>).phone_number_id : null;
      if (currentPhoneNumberId !== phoneNumberId) continue;
      const messages = Array.isArray(changeValue.messages) ? changeValue.messages as Array<Record<string, unknown>> : [];
      for (const message of messages) {
        if (typeof message.id !== "string" || typeof message.from !== "string" || typeof message.type !== "string") continue;
        const messageText = message.type === "text" && message.text && typeof message.text === "object" ? (message.text as Record<string, unknown>).body : null;
        const boundedText = boundText(typeof messageText === "string" ? messageText : null, MAX_MESSAGE_TEXT_LENGTH);
        const normalizedText = boundedText ? normalizeInboundTriggerText(boundedText) : null;
        const waId = message.from;
        extracted.push({
          metaMessageId: message.id,
          phoneNumberId,
          waId,
          fromPhone: normalizeWhatsApp(waId),
          profileName: contactProfileName(changeValue, waId),
          messageType: message.type,
          messageText: boundedText,
          normalizedText,
          referral: referralObject(message.referral),
          rawPayload: boundJsonValue({
            object: (payload as Record<string, unknown>).object ?? null,
            entryId: entryItem.id ?? null,
            changeField: change.field,
            metadata: changeValue.metadata ?? null,
            contacts: changeValue.contacts ?? [],
            message,
          }),
          receivedAt: now,
        });
      }
    }
  }

  return extracted;
}
