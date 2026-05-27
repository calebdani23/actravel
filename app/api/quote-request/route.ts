import { NextResponse } from "next/server";
import { createQuoteRequest } from "@/lib/leads/quote-request-service";
import { createQuoteRequestSchema, quoteValidationCopy, type QuoteRequestErrorResponse, type QuoteRequestResponse } from "@/lib/validations/quote-request";
import { type Locale } from "@/lib/i18n/config";

function requestLocale(payload: unknown): Locale {
  if (payload && typeof payload === "object" && "locale" in payload && payload.locale === "en") return "en";
  return "es";
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    const body: QuoteRequestErrorResponse = { ok: false, message: quoteValidationCopy.es.invalid };
    return NextResponse.json<QuoteRequestResponse>(body, { status: 400 });
  }

  const locale = requestLocale(payload);
  const parsed = createQuoteRequestSchema(locale).safeParse(payload);
  if (!parsed.success) {
    const body: QuoteRequestErrorResponse = {
      ok: false,
      message: quoteValidationCopy[locale].invalid,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
    return NextResponse.json<QuoteRequestResponse>(body, { status: 400 });
  }

  try {
    const body = await createQuoteRequest(parsed.data);
    return NextResponse.json<QuoteRequestResponse>(body, { status: 201 });
  } catch (error) {
    console.error("quote-request persistence failed", error);
    const body: QuoteRequestErrorResponse = { ok: false, message: quoteValidationCopy[locale].server };
    return NextResponse.json<QuoteRequestResponse>(body, { status: 500 });
  }
}
