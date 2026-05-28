import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PublicRateLimitScope = "quote_request" | "whatsapp_click";

type ScopeConfig = Readonly<{
  max: number;
  windowSeconds: number;
}>;

type RateLimitRow = Readonly<{
  scope: PublicRateLimitScope;
  key_hash: string;
  window_start: string;
  count: number;
  context_hash: string | null;
  metadata: Record<string, string | number | boolean | null>;
}>;

type RateLimitStore = Readonly<{
  increment(row: RateLimitRow): Promise<number>;
}>;

export type PublicRateLimitResult = Readonly<{
  allowed: boolean;
  limit: number;
  count: number;
  windowSeconds: number;
  retryAfterSeconds?: number;
  keyHash: string;
  usedFallback: boolean;
}>;

const DEFAULT_CONFIG: Record<PublicRateLimitScope, ScopeConfig> = {
  quote_request: { max: 5, windowSeconds: 60 * 60 },
  whatsapp_click: { max: 60, windowSeconds: 15 * 60 },
};

const MAX_HEADER_LENGTH = 240;
const fallbackCounters = new Map<string, { count: number; expiresAt: number }>();
let testStore: RateLimitStore | null = null;

function readPositiveInt(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function scopeConfig(scope: PublicRateLimitScope): ScopeConfig {
  const defaults = DEFAULT_CONFIG[scope];
  const prefix = scope === "quote_request" ? "QUOTE_REQUEST" : "WHATSAPP_CLICK";
  return {
    max: readPositiveInt(`PUBLIC_RATE_LIMIT_${prefix}_MAX`, defaults.max),
    windowSeconds: readPositiveInt(`PUBLIC_RATE_LIMIT_${prefix}_WINDOW_SECONDS`, defaults.windowSeconds),
  };
}

function boundedHeader(value: string | null) {
  return value?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_HEADER_LENGTH) || "unknown";
}

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || null;
}

export function hashPublicRateLimitValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function requesterKeyHash(request: Request) {
  const salt = process.env.PUBLIC_RATE_LIMIT_SALT || process.env.WHATSAPP_CLICK_HASH_SALT || "actravel-public-rate-limit";
  const ip = requestIp(request);
  const userAgent = boundedHeader(request.headers.get("user-agent"));
  const source = ip ? `ip:${ip}` : `ua:${userAgent}`;
  return hashPublicRateLimitValue(`${salt}:${source}`);
}

function contextHash(context?: string) {
  const bounded = context?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 180);
  return bounded ? hashPublicRateLimitValue(bounded) : null;
}

function windowStart(now: Date, windowSeconds: number) {
  return new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString();
}

function retryAfter(now: Date, windowIso: string, windowSeconds: number) {
  const windowEnd = new Date(windowIso).getTime() + windowSeconds * 1000;
  return Math.max(1, Math.ceil((windowEnd - now.getTime()) / 1000));
}

function fallbackIncrement(row: RateLimitRow, windowSeconds: number) {
  const cacheKey = `${row.scope}:${row.key_hash}:${row.window_start}`;
  const now = Date.now();
  const current = fallbackCounters.get(cacheKey);
  if (!current || current.expiresAt <= now) {
    fallbackCounters.set(cacheKey, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return 1;
  }
  current.count += 1;
  return current.count;
}

function supabaseRateLimitStore(): RateLimitStore {
  return {
    async increment(row) {
      const supabase = createSupabaseAdminClient();
      const query = supabase
        .from("public_rate_limits")
        .select("count")
        .eq("scope", row.scope)
        .eq("key_hash", row.key_hash)
        .eq("window_start", row.window_start)
        .maybeSingle();
      const { data, error } = await query;
      if (error) throw error;
      const nextCount = (typeof data?.count === "number" ? data.count : 0) + 1;
      const { error: upsertError } = await supabase.from("public_rate_limits").upsert(
        { ...row, count: nextCount, last_seen_at: new Date().toISOString() },
        { onConflict: "scope,key_hash,window_start" },
      );
      if (upsertError) throw upsertError;
      return nextCount;
    },
  };
}

export async function checkPublicRateLimit(scope: PublicRateLimitScope, request: Request, context?: string): Promise<PublicRateLimitResult> {
  const config = scopeConfig(scope);
  const now = new Date();
  const windowIso = windowStart(now, config.windowSeconds);
  const keyHash = requesterKeyHash(request);
  const row: RateLimitRow = {
    scope,
    key_hash: keyHash,
    window_start: windowIso,
    count: 1,
    context_hash: contextHash(context),
    metadata: { version: 1 },
  };

  let count: number;
  let usedFallback = false;
  try {
    count = await (testStore ?? supabaseRateLimitStore()).increment(row);
  } catch (error) {
    usedFallback = true;
    if (scope === "whatsapp_click") {
      console.error("public rate limit storage skipped", error);
      count = 1;
    } else {
      console.error("public rate limit storage fallback", error);
      count = fallbackIncrement(row, config.windowSeconds);
    }
  }

  const allowed = count <= config.max;
  return {
    allowed,
    limit: config.max,
    count,
    windowSeconds: config.windowSeconds,
    retryAfterSeconds: allowed ? undefined : retryAfter(now, windowIso, config.windowSeconds),
    keyHash,
    usedFallback,
  };
}

export function resetPublicRateLimitFallbackForTests() {
  fallbackCounters.clear();
  testStore = null;
}

export function setPublicRateLimitStoreForTests(store: RateLimitStore | null) {
  testStore = store;
}
