import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { checkPublicRateLimit } from "@/lib/security/public-rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildWhatsAppUrl,
  sanitizeWhatsAppLocale,
  sanitizeWhatsAppMessage,
  sanitizeWhatsAppPagePath,
  sanitizeWhatsAppPhone,
  sanitizeWhatsAppUuid,
} from "@/lib/whatsapp/link";

export const runtime = "nodejs";

const FALLBACK_MESSAGE = "Hola AC Travel Mx, quisiera cotizar mi próximo viaje.";
const MAX_USER_AGENT_LENGTH = 240;

function boundedHeader(value: string | null) {
  return value?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_USER_AGENT_LENGTH) || null;
}

function requestIpHash(request: Request) {
  const salt = process.env.WHATSAPP_CLICK_HASH_SALT;
  if (!salt) return null;
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const ip = forwardedFor || realIp;
  if (!ip) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const message = sanitizeWhatsAppMessage(url.searchParams.get("message")) ?? FALLBACK_MESSAGE;
  const phone = sanitizeWhatsAppPhone(url.searchParams.get("phone"));
  const locale = sanitizeWhatsAppLocale(url.searchParams.get("locale"));
  const pagePath = sanitizeWhatsAppPagePath(url.searchParams.get("pagePath") ?? url.searchParams.get("source"));
  const leadId = sanitizeWhatsAppUuid(url.searchParams.get("leadId"));
  const contactId = sanitizeWhatsAppUuid(url.searchParams.get("contactId"));
  const finalUrl = buildWhatsAppUrl(message, phone ?? undefined);

  try {
    const limit = await checkPublicRateLimit("whatsapp_click", request, pagePath ?? locale);
    if (!limit.allowed) return NextResponse.redirect(finalUrl, { status: 302 });

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("whatsapp_clicks").insert({
      lead_id: leadId,
      contact_id: contactId,
      locale,
      page_path: pagePath,
      phone,
      message,
      user_agent: boundedHeader(request.headers.get("user-agent")),
      ip_hash: requestIpHash(request),
    });
    if (error) console.error("WhatsApp click logging failed", error.message);
  } catch (error) {
    console.error("WhatsApp click logging skipped", error);
  }

  return NextResponse.redirect(finalUrl, { status: 302 });
}
