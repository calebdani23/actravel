import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CustomerIdentity = { accountId: string; displayName: string };
export type PortalAuthDependencies = {
  resolve(email: string, invitationToken: string | null, requestOtp: boolean): Promise<string | null>;
  send(email: string, createUser: boolean): Promise<void>;
  verify(email: string, code: string): Promise<void>;
  redeem(token: string): Promise<boolean>;
  identity(): Promise<CustomerIdentity | null>;
  clear(): Promise<void>;
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export function decodeCustomerIdentity(value: unknown, verifiedUserId: string): CustomerIdentity | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join(",") !== "accountId,displayName,ok" || row.ok !== true
    || row.accountId !== verifiedUserId || !uuid.test(verifiedUserId)
    || typeof row.displayName !== "string" || row.displayName.length > 160) return null;
  return { accountId: verifiedUserId, displayName: row.displayName };
}

export async function getCustomerIdentity(): Promise<CustomerIdentity | null> {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return null;
    const result = await client.rpc("current_customer_identity");
    return result.error ? null : decodeCustomerIdentity(result.data, user.id);
  } catch { return null; }
}

function credentials(input: { email: unknown; invitationToken: unknown }) {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const token = input.invitationToken === "" || input.invitationToken == null ? null : input.invitationToken;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
    || token !== null && (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))) return null;
  return { email, token: token as string | null };
}

function dependencies(): PortalAuthDependencies {
  return {
    resolve: async (email, token, requestOtp) => {
      const { data, error } = await createSupabaseAdminClient().rpc("portal_resolve_access", {
        p_email: email, p_token: token, p_request_otp: requestOtp,
      });
      return !error && data === email ? email : null;
    },
    send: async (email, createUser) => {
      const { error } = await (await createClient()).auth.signInWithOtp({ email, options: { shouldCreateUser: createUser } });
      if (error) throw new Error("OTP_UNAVAILABLE");
    },
    verify: async (email, token) => {
      const { error } = await (await createClient()).auth.verifyOtp({ email, token, type: "email" });
      if (error) throw new Error("OTP_REJECTED");
    },
    redeem: async token => {
      const { data, error } = await (await createClient()).rpc("redeem_portal_invitation", { p_token: token });
      return !error && data?.ok === true;
    },
    identity: getCustomerIdentity,
    clear: async () => { await (await createClient()).auth.signOut({ scope: "local" }); },
  };
}

export async function requestCustomerCode(input: { email: unknown; invitationToken: unknown }, deps = dependencies()) {
  const parsed = credentials(input);
  try {
    if (parsed && await deps.resolve(parsed.email, parsed.token, true)) await deps.send(parsed.email, parsed.token !== null);
  } catch { /* Same response for unknown, ineligible, throttled, or delivery failure. */ }
  return { ok: true as const };
}

export async function verifyCustomerCode(input: { email: unknown; invitationToken: unknown; code: unknown }, deps = dependencies()) {
  const parsed = credentials(input);
  if (!parsed || typeof input.code !== "string" || !/^\d{6}$/.test(input.code)) return { ok: false };
  let authenticated = false;
  try {
    if (!await deps.resolve(parsed.email, parsed.token, false)) return { ok: false };
    await deps.verify(parsed.email, input.code);
    authenticated = true;
    if ((!parsed.token || await deps.redeem(parsed.token)) && await deps.identity()) return { ok: true };
  } catch { /* Never expose provider details or treat Auth alone as portal access. */ }
  if (authenticated) { try { await deps.clear(); } catch { /* Page guard still denies an unlinked session. */ } }
  return { ok: false };
}
