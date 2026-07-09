import { NextResponse } from "next/server";
import { createPublicSupabaseClient } from "@/lib/supabase/public-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  if (process.env.ALLOW_DEBUG_PUBLIC_CATALOG !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = createPublicSupabaseClient();

  const [destinations, services, packagesRows, promotions] = await Promise.all([
    supabase
      .from("destinations")
      .select("id, slug_es, name_es, status, published_at")
      .eq("status", "published")
      .limit(10),

    supabase
      .from("services")
      .select("id, slug_es, name_es, status, published_at")
      .eq("status", "published")
      .limit(10),

    supabase
      .from("packages")
      .select("id, slug_es, name_es, status, published_at")
      .eq("status", "published")
      .limit(10),

    supabase
      .from("promotions")
      .select("id, slug_es, title_es, status, published_at")
      .eq("status", "published")
      .limit(10),
  ]);

  return NextResponse.json({
    env: {
      hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasPublishableKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
      urlHost: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
        : null,
      keyPrefix: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.slice(0, 14) ?? null,
    },
    destinations: {
      count: destinations.data?.length ?? 0,
      error: destinations.error
        ? {
            message: destinations.error.message,
            code: destinations.error.code,
            details: destinations.error.details,
            hint: destinations.error.hint,
          }
        : null,
      data: destinations.data,
    },
    services: {
      count: services.data?.length ?? 0,
      error: services.error
        ? {
            message: services.error.message,
            code: services.error.code,
            details: services.error.details,
            hint: services.error.hint,
          }
        : null,
      data: services.data,
    },
    packages: {
      count: packagesRows.data?.length ?? 0,
      error: packagesRows.error
        ? {
            message: packagesRows.error.message,
            code: packagesRows.error.code,
            details: packagesRows.error.details,
            hint: packagesRows.error.hint,
          }
        : null,
      data: packagesRows.data,
    },
    promotions: {
      count: promotions.data?.length ?? 0,
      error: promotions.error
        ? {
            message: promotions.error.message,
            code: promotions.error.code,
            details: promotions.error.details,
            hint: promotions.error.hint,
          }
        : null,
      data: promotions.data,
    },
  });
}
