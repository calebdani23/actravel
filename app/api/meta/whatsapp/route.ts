import { NextResponse } from "next/server";
import { processWhatsAppWebhookPayload } from "@/lib/leads/whatsapp-inbound-service";
import { verifyMetaSignature } from "@/lib/leads/whatsapp-inbound";

export const runtime = "nodejs";

function config() {
  return {
    verifyToken: process.env.META_WHATSAPP_VERIFY_TOKEN,
    appSecret: process.env.META_APP_SECRET,
    phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { verifyToken } = config();
  const mode = url.searchParams.get("hub.mode");
  const challenge = url.searchParams.get("hub.challenge");
  const suppliedToken = url.searchParams.get("hub.verify_token");

  if (mode === "subscribe" && challenge && verifyToken && suppliedToken === verifyToken) {
    return new NextResponse(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }

  return NextResponse.json({ ok: false }, { status: 403 });
}

export async function POST(request: Request) {
  const { appSecret, phoneNumberId } = config();
  if (!appSecret || !phoneNumberId) return NextResponse.json({ ok: false }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(rawBody, signature, appSecret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await processWhatsAppWebhookPayload(payload, { phoneNumberId });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Meta WhatsApp webhook processing failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
