// Verification only: simulated Auth/Storage transport; actual application SQL/RLS.
import { createServer } from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import { actorSession, psql, serviceSession, sqlLiteral, withPostgresContainer } from "./postgres-runtime";
import { portalActors, portalId, portalPdfBytes, portalPdfHash, preparePortalQuotesDatabase, registerPortalQuote } from "./customer-quotes-runtime";

const people = [
  { id: portalActors.alice, email: "alice@quotes.test", name: "Alice" },
  { id: portalActors.bob, email: "bob@quotes.test", name: "Bob" },
  { id: portalActors.admin, email: "admin@quotes.test", name: "Admin" },
  { id: portalActors.advisor, email: "advisor@quotes.test", name: "Advisor" },
  { id: portalActors.operations, email: "ops@quotes.test", name: "Operations" },
];
const sessions = new Map<string, (typeof people)[number]>();
const signingKey = randomUUID();
const scalar = (sql: string) => psql("quote_base", sql).split(/\r?\n/).at(-1)!;
const json = (sql: string) => JSON.parse(scalar(sql));
const apiUser = (person: (typeof people)[number]) => ({ id: person.id, email: person.email, aud: "authenticated", role: "authenticated",
  email_confirmed_at: "2026-01-01T00:00:00Z", confirmed_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [] });
function session(person: (typeof people)[number]) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: person.id, email: person.email, aud: "authenticated", role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), jti: randomUUID() })).toString("base64url");
  const body = `${header}.${payload}`;
  const token = `${body}.${createHmac("sha256", signingKey).update(body).digest("base64url")}`;
  sessions.set(token, person);
  return { access_token: token, refresh_token: randomUUID(), expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer", user: apiUser(person) };
}
const allowedRpcs = ["current_customer_identity", "read_customer_quotes", "read_customer_quote", "read_customer_quote_pdf",
  "accept_customer_quote", "request_customer_quote_change", "read_portal_quote_work", "claim_portal_quote_work", "manage_portal_quote_work"];

async function main() {
  await withPostgresContainer(async () => {
    preparePortalQuotesDatabase(92);
    psql("quote_base", `insert into public.leads(id,contact_id,status_id) values('${portalId(23)}','${portalId(11)}','${portalId(13)}');`);
    const quotes = { alice: registerPortalQuote(), bob: registerPortalQuote(portalId(22), "browser_b"), intake: registerPortalQuote(portalId(23), "browser_intake") };
    const rpcParams = new Map<string, string[]>(json(`select json_agg(json_build_array(p.proname,coalesce(p.proargnames,array[]::text[])))
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (${allowedRpcs.map(sqlLiteral).join(",")});`));
    let revision = 0;
    const server = createServer(async (request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const reply = (status: number, value: unknown) => {
        if (!["/health", "/fixtures"].includes(url.pathname)) console.log(JSON.stringify({ route: url.pathname, status,
          result: value && typeof value === "object" ? { ok: (value as { ok?: boolean }).ok, code: (value as { code?: string }).code } : typeof value }));
        response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        response.end(status === 204 ? undefined : JSON.stringify(value));
      };
      try {
        const bearer = (request.headers.authorization ?? "").replace(/^Bearer /, "");
        const person = sessions.get(bearer);
        let raw = "";
        for await (const chunk of request) { raw += chunk.toString(); if (raw.length > 16384) throw new Error("Body limit"); }
        const body = raw ? JSON.parse(raw) : {};
        if (url.pathname === "/health") return reply(200, { ok: true, runId: process.env.WEEK05_VERIFICATION_RUN });
        if (url.pathname === "/fixtures") return reply(200, { people, quotes, pdfHash: portalPdfHash });
        // Fixed scenario controls are local fixture operations, never application endpoints.
        if (url.pathname === "/scenario/publish-terms" && request.method === "POST") {
          revision++;
          return reply(200, json(`${actorSession(portalActors.admin)} select public.publish_portal_quote_terms('browser-test-${revision}','TEST ONLY synthetic approved conditions ${revision}.')::text;`));
        }
        if (url.pathname === "/auth/v1/otp" && request.method === "POST") return reply(200, {});
        if (url.pathname === "/auth/v1/verify" && request.method === "POST") {
          const verified = people.find(value => value.email === body.email);
          if (!verified || body.type !== "email" || body.token !== "123456") return reply(403, { msg: "Invalid local OTP", error_code: "otp_expired" });
          return reply(200, session(verified));
        }
        if (url.pathname === "/auth/v1/user") return reply(person ? 200 : 401, person ? apiUser(person) : { msg: "Not authenticated" });
        if (url.pathname === "/auth/v1/logout") { sessions.delete(bearer); return reply(204, null); }
        if (url.pathname === "/rest/v1/rpc/portal_resolve_access") {
          if (request.headers.apikey !== "sb_secret_local_test") return reply(403, { message: "Denied" });
          const token = body.p_token == null ? "null" : sqlLiteral(String(body.p_token));
          return reply(200, json(`${serviceSession()} select coalesce(to_json(public.portal_resolve_access(${sqlLiteral(String(body.p_email))},${token},${body.p_request_otp === true}))::text,'null');`));
        }
        const rpc = url.pathname.replace("/rest/v1/rpc/", "");
        if (allowedRpcs.includes(rpc) && request.method === "POST") {
          if (!person) return reply(401, { message: "Denied" });
          if (!Object.keys(body).every(key => rpcParams.get(rpc)?.includes(key))) return reply(400, { message: "Unknown parameter" });
          const args = Object.entries(body).map(([key, value]) => `${key} => ${value == null ? "null" : sqlLiteral(String(value))}`).join(",");
          return reply(200, json(`${actorSession(person.id)} select coalesce(to_json(public.${rpc}(${args}))::text,'null');`));
        }
        if (url.pathname === "/rest/v1/profiles" && person) {
          const rows = json(`${actorSession(person.id)} select coalesce(json_agg(p),'[]') from public.profiles p where id='${person.id}';`);
          if (String(request.headers.accept).includes("vnd.pgrst.object")) return rows.length ? reply(200, rows[0]) : reply(406, { code: "PGRST116", details: "0 rows", message: "No row" });
          return reply(200, rows);
        }
        if (url.pathname === "/rest/v1/profile_roles" && person) {
          return reply(200, json(`${actorSession(person.id)} select coalesce(json_agg(json_build_object('roles',json_build_object('name',r.name))),'[]')
            from public.profile_roles pr join public.roles r on r.id=pr.role_id where pr.profile_id='${person.id}';`));
        }
        if (url.pathname.startsWith("/storage/v1/object/quote-pdfs/") && request.method === "GET") {
          const objectPath = decodeURIComponent(url.pathname.slice("/storage/v1/object/quote-pdfs/".length));
          if (bearer !== "sb_secret_local_test" || !Object.values(quotes).some(q => q.path === objectPath)) return reply(403, { message: "Denied" });
          response.writeHead(200, { "Content-Type": "application/pdf", "Content-Length": portalPdfBytes.length, "Cache-Control": "no-store" });
          return response.end(portalPdfBytes);
        }
        return reply(404, { message: "Endpoint outside fixture scope" });
      } catch (error) {
        console.error("Fixture handler failed", error instanceof Error ? error.message : typeof error);
        return reply(500, { message: "Local fixture failure" });
      }
    });
    await new Promise<void>(resolve => server.listen(3137, "127.0.0.1", resolve));
    console.log("Fixture ready: real PostgreSQL/RLS, simulated Auth/Storage HTTP, no hosted services");
    await new Promise<void>(resolve => {
      const stop = () => { server.close(() => resolve()); server.closeAllConnections(); };
      process.once("SIGTERM", stop); process.once("SIGINT", stop);
    });
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; });
