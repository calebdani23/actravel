import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { actorSession, applyMigration, migrationNames, prepareBaseDatabase, psql, psqlAsync, sqlLiteral, withPostgresContainer } from "./helpers/postgres-runtime";

const migration = "0090_customer_portal_identity.sql";
const id = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const admin = id(1), customerA = id(2), customerB = id(3), stranger = id(4);
const contactA = id(10), contactB = id(11);
const last = (result: string) => result.split(/\r?\n/).at(-1)!;

test("customer invitation, identity, and staff isolation are enforced by PostgreSQL", {
  skip: process.env.RUN_CUSTOMER_IDENTITY_DB_TESTS !== "1", timeout: 360_000,
}, async () => withPostgresContainer(async () => {
  prepareBaseDatabase();
  for (const name of migrationNames().filter(name => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 89)) applyMigration("quote_base", name);
  psql("quote_base", "alter table auth.users add column email_confirmed_at timestamptz;");
  if (existsSync(`db/migrations/${migration}`)) applyMigration("quote_base", migration);
  assert.equal(last(psql("quote_base", "select to_regclass('public.customer_accounts')::text;")), "customer_accounts");
  assert.deepEqual(JSON.parse(last(psql("quote_base", `select coalesce(json_agg(c.relname order by c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;`))), [], "Every exposed application table must enforce RLS");
  // Model Supabase's exposed-schema read grants; RLS must still deny customers.
  psql("quote_base", "grant select on all tables in schema public to authenticated;");
  psql("quote_base", `insert into auth.users(id,email,email_confirmed_at) values
    ('${admin}','admin@portal.test',now()),('${customerA}','a@portal.test',now()),
    ('${customerB}','b@portal.test',now()),('${stranger}','stranger@portal.test',now());
    insert into public.profiles(id,full_name,is_active) values('${admin}','Admin',true);
    insert into public.roles(name) values('admin') on conflict(name) do nothing;
    insert into public.profile_roles(profile_id,role_id) select '${admin}',id from public.roles where name='admin';
    insert into public.contacts(id,first_name,email,notes) values
    ('${contactA}','Customer A','a@portal.test','PRIVATE STAFF NOTE'),('${contactB}','Customer B','b@portal.test','PRIVATE B');`);
  const invoke = (actor: string, expression: string) => JSON.parse(last(psql("quote_base", `${actorSession(actor)} select (${expression})::text;`)));
  const issue = (contact: string) => invoke(admin, `public.issue_portal_invitation('${contact}')`);
  const redeem = (actor: string, token: string) => invoke(actor, `public.redeem_portal_invitation(${sqlLiteral(token)})`);

  assert.deepEqual(invoke(customerA, `public.issue_portal_invitation('${contactA}')`), { ok: false, code: "ACCESS_DENIED" });
  psql("quote_base", `insert into public.contacts(id,first_name,email) values('${id(12)}','Duplicate','a@portal.test');`);
  assert.equal(issue(contactA).ok, false);
  psql("quote_base", `update public.contacts set email='resolved-duplicate@portal.test' where id='${id(12)}';
    insert into public.contacts(id,first_name,email) values('${id(13)}','Staff','admin@portal.test');`);
  assert.equal(issue(id(13)).ok, false);
  const invitation = issue(contactA);
  assert.equal(invitation.ok, true);
  assert.match(invitation.token, /^[a-f0-9]{64}$/);
  assert.equal(last(psql("quote_base", `select token_hash = encode(extensions.digest(${sqlLiteral(invitation.token)},'sha256'),'hex') from public.portal_invitations where id='${invitation.invitationId}';`)), "t");
  assert.deepEqual(redeem(customerB, invitation.token), { ok: false, code: "ACCESS_DENIED" });
  assert.equal(last(psql("quote_base", "select count(*) from public.customer_accounts;")), "0");
  psql("quote_base", `update auth.users set email_confirmed_at=null where id='${customerA}';`);
  assert.equal(redeem(customerA, invitation.token).ok, false);
  psql("quote_base", `update auth.users set email_confirmed_at=now() where id='${customerA}';`);
  const results = await Promise.all([1, 2].map(() => psqlAsync("quote_base", `${actorSession(customerA)} select public.redeem_portal_invitation(${sqlLiteral(invitation.token)})::text;`)));
  assert.ok(results.map(value => JSON.parse(last(value))).every(value => value.ok));
  assert.equal(last(psql("quote_base", "select count(*) from public.customer_accounts;")), "1");
  assert.equal(last(psql("quote_base", "select count(*) from public.portal_access_events where event_type='redeemed';")), "1");
  const b = issue(contactB);
  assert.equal(redeem(customerB, b.token).ok, true);
  assert.deepEqual(invoke(customerA, "public.current_customer_identity()"), { ok: true, accountId: customerA, displayName: "Customer A" });
  assert.equal(last(psql("quote_base", `${actorSession(customerA)} select count(*) from public.customer_accounts;`)), "1");
  assert.equal(last(psql("quote_base", `${actorSession(customerA)} select count(*) from public.customer_accounts where user_id='${customerB}';`)), "0");
  assert.equal(last(psql("quote_base", `${actorSession(customerA)} select count(*) from public.contacts;`)), "0");
  assert.equal(last(psql("quote_base", `${actorSession(customerA)} select count(*) from public.profiles;`)), "0");
  assert.equal(last(psql("quote_base", `${actorSession(customerA)} select count(*) from public.portal_invitations;`)), "0");
  assert.equal(last(psql("quote_base", `${actorSession(customerA)} select count(*) from public.portal_access_events;`)), "0");
  assert.equal(invoke(stranger, "public.current_customer_identity()").ok, false);
  assert.throws(() => psql("quote_base", `${actorSession(customerA)} update public.customer_accounts set contact_id='${contactB}';`), /permission denied/);
  assert.throws(() => psql("quote_base", `${actorSession(customerA)} select public.portal_resolve_access('b@portal.test',null,false);`), /permission denied/);
  assert.throws(() => psql("quote_base", `insert into public.profiles(id,full_name,is_active) values('${customerA}','Escalation',true);`), /CUSTOMER_STAFF_COLLISION/);
  assert.equal(last(psql("quote_base", `select count(*) from public.profiles where id in ('${customerA}','${customerB}');`)), "0");
  psql("quote_base", `update public.contacts set blocked_at=now() where id='${contactA}';`);
  assert.equal(invoke(customerA, "public.current_customer_identity()").ok, false);
  psql("quote_base", `update public.contacts set blocked_at=null where id='${contactA}';`);
  assert.equal(invoke(customerA, "public.current_customer_identity()").ok, true);
  assert.equal(invoke(admin, `public.disable_customer_account('${customerA}')`).ok, true);
  assert.equal(invoke(customerA, "public.current_customer_identity()").ok, false);
  assert.equal(redeem(customerA, invitation.token).ok, false);
  const old = issue(contactB), replacement = issue(contactB);
  assert.equal(redeem(customerB, old.token).ok, false);
  assert.equal(invoke(admin, `public.revoke_portal_invitation('${replacement.invitationId}')`).ok, true);
  assert.equal(redeem(customerB, replacement.token).ok, false);
  const expired = issue(contactB);
  psql("quote_base", `update public.portal_invitations set expires_at=now()-interval '1 minute' where id='${expired.invitationId}';`);
  assert.equal(redeem(customerB, expired.token).ok, false);
  assert.equal(invoke(admin, "public.current_customer_identity()").ok, false);
  assert.equal(last(psql("quote_base", `${actorSession(admin)} select count(*) from public.contacts;`)), "4");
  psql("quote_base", `insert into public.destinations(name_es,name_en,slug_es,slug_en,status) values
    ('Public','Public','portal-public','portal-public','published'),('Private','Private','portal-private','portal-private','draft');
    grant select on public.destinations to anon;`);
  assert.equal(last(psql("quote_base", `${actorSession(admin)} select count(*) from public.destinations;`)), "2");
  assert.equal(last(psql("quote_base", `${actorSession(customerB)} select count(*) from public.destinations;`)), "1");
  assert.equal(last(psql("quote_base", "set role anon; select count(*) from public.destinations;")), "1");
  assert.throws(() => psql("quote_base", "set role anon; select public.current_customer_identity();"), /permission denied/);
  const resolve = (record: boolean) => JSON.parse(last(psql("quote_base", `set role service_role;
    select coalesce(to_json(public.portal_resolve_access('b@portal.test',null,${record}))::text,'null');`)));
  assert.equal(resolve(true), "b@portal.test");
  assert.equal(resolve(true), null);
  assert.equal(resolve(false), "b@portal.test");
  assert.equal(last(psql("quote_base", `select count(*) from public.portal_access_events where event_type='access_requested';`)), "1");
  assert.throws(() => psql("quote_base", "delete from public.portal_access_events;"), /APPEND_ONLY/);
}));
