import { createHash } from "node:crypto";
import { actorSession, applyMigration, migrationNames, prepareBaseDatabase, psql, serviceSession, sqlLiteral } from "./postgres-runtime";

export const portalId = (n: number) => `d0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const portalActors = { admin: portalId(1), advisor: portalId(2), alice: portalId(3), bob: portalId(4), operations: portalId(5) };
export const portalPdfBytes = Buffer.from("%PDF-1.7\nPORTAL VERIFICATION FIXTURE\n%%EOF\n");
export const portalPdfHash = createHash("sha256").update(portalPdfBytes).digest("hex");
export const sqlJson = (value: string) => JSON.parse(value.split(/\r?\n/).findLast(line => /^[\[{]/.test(line))!);

export function preparePortalQuotesDatabase(lastMigration = 91) {
  prepareBaseDatabase();
  for (const name of migrationNames().filter(name => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 89)) applyMigration("quote_base", name);
  psql("quote_base", "alter table auth.users add column email_confirmed_at timestamptz;");
  for (const name of migrationNames().filter(name => Number(name.slice(0, 4)) >= 90 && Number(name.slice(0, 4)) <= lastMigration)) applyMigration("quote_base", name);
  psql("quote_base", `insert into auth.users(id,email,email_confirmed_at) values
    ('${portalActors.admin}','admin@quotes.test',now()),('${portalActors.advisor}','advisor@quotes.test',now()),
    ('${portalActors.alice}','alice@quotes.test',now()),('${portalActors.bob}','bob@quotes.test',now()),('${portalActors.operations}','ops@quotes.test',now());
    insert into public.profiles(id,full_name,is_active) values ('${portalActors.admin}','Admin',true),('${portalActors.advisor}','Advisor',true),('${portalActors.operations}','Operations',true);
    insert into public.roles(name) values('admin'),('asesor'),('operaciones') on conflict(name) do nothing;
    insert into public.profile_roles(profile_id,role_id) select '${portalActors.admin}',id from public.roles where name='admin';
    insert into public.profile_roles(profile_id,role_id) select '${portalActors.advisor}',id from public.roles where name='asesor';
    insert into public.profile_roles(profile_id,role_id) select '${portalActors.operations}',id from public.roles where name='operaciones';
    insert into public.contacts(id,first_name,email,notes) values ('${portalId(11)}','Alice','alice@quotes.test','PRIVATE CONTACT NOTE'),('${portalId(12)}','Bob','bob@quotes.test','PRIVATE CONTACT NOTE');
    insert into public.customer_accounts(user_id,contact_id,email) values('${portalActors.alice}','${portalId(11)}','alice@quotes.test'),('${portalActors.bob}','${portalId(12)}','bob@quotes.test');
    insert into public.lead_statuses(id,name,label_es,label_en,is_terminal) values('${portalId(13)}','portal_open','Open','Open',false);
    insert into public.leads(id,contact_id,status_id,assigned_to) values('${portalId(21)}','${portalId(11)}','${portalId(13)}','${portalActors.advisor}'),('${portalId(22)}','${portalId(12)}','${portalId(13)}','${portalActors.advisor}');
    grant select on all tables in schema public to authenticated;
    grant select,insert on storage.objects to authenticated,service_role;`);
}

export function portalRpc(actor: string, expression: string) {
  return sqlJson(psql("quote_base", `${actorSession(actor)} select (${expression})::text;`));
}

export function registerPortalQuote(lead = portalId(21), key = "portal_quote_a", sent = true, validUntil = "2099-12-31") {
  const intent = sqlJson(psql("quote_base", `${actorSession(portalActors.admin)} select row_to_json(r)::text from
    public.crm_begin_quote_registration('${lead}','Proposal ${key}','Customer commercial summary','MXN',1250,250,
      '${validUntil}','PRIVATE VERSION NOTE',null,${portalPdfBytes.length},'${portalPdfHash}','${key}') r;`));
  psql("quote_base", `${actorSession(portalActors.admin)} insert into storage.objects(bucket_id,name,owner_id,metadata)
    values('quote-pdfs',${sqlLiteral(intent.path)},'${portalActors.admin}',jsonb_build_object('size','${portalPdfBytes.length}','mimetype','application/pdf'));`);
  const registered = sqlJson(psql("quote_base", `${serviceSession()} select row_to_json(r)::text from public.crm_register_quote_with_pdf('${intent.intent_id}',${portalPdfBytes.length},'${portalPdfHash}') r;`));
  if (sent) {
    const lock = psql("quote_base", `select lock_version from public.quotes where id='${registered.quote_id}';`);
    psql("quote_base", `${actorSession(portalActors.admin)} select * from public.crm_mark_quote_sent('${registered.quote_id}','${registered.quote_version_id}',${lock},'send_${key}');`);
  }
  return { quoteId: registered.quote_id as string, versionId: registered.quote_version_id as string, documentId: registered.document_id as string, path: intent.path as string };
}
