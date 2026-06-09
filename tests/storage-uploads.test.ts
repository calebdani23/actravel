import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildStoragePath, removeStoredObject, removeStoredObjects, safeUploadSlug, sameStorageObject, uploadScope, validateUploadFile } from "@/lib/admin/storage-uploads";

test("storage upload validation accepts configured MIME types and rejects invalid files", () => {
  assert.equal(validateUploadFile(new File(["pdf"], "voucher.pdf", { type: "application/pdf" }), "documents").extension, "pdf");
  assert.equal(validateUploadFile(new File(["img"], "foto.jpeg", { type: "image/jpeg" }), "payment-proofs").extension, "jpg");
  assert.throws(() => validateUploadFile(new File(["bad"], "script.txt", { type: "text/plain" }), "documents"), /Tipo de archivo no permitido/);
  assert.throws(() => validateUploadFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.pdf", { type: "application/pdf" }), "payment-proofs"), /excede el límite de 10 MB/);
});

test("storage paths use namespace precedence, UTC date, UUID, safe slug, and MIME extension", () => {
  const file = new File(["x"], "Pasaporte Cliente Á.C.pdf", { type: "application/pdf" });
  const path = buildStoragePath("documents", file, { bookingId: "book-1", leadId: "lead-1", contactId: "contact-1" }, new Date("2026-05-02T00:00:00Z"), "uuid-1");

  assert.equal(uploadScope({ bookingId: "book-1", leadId: "lead-1", contactId: "contact-1" }), "booking-book-1");
  assert.equal(uploadScope({ leadId: "lead-1", contactId: "contact-1" }), "lead-lead-1");
  assert.equal(uploadScope({ contactId: "contact-1" }), "contact-contact-1");
  assert.equal(uploadScope({}), "unassigned");
  assert.equal(safeUploadSlug("Pasaporte Cliente Á.C.pdf"), "pasaporte-cliente-a-c");
  assert.equal(path, "documents/booking-book-1/2026/05/uuid-1-pasaporte-cliente-a-c.pdf");
});

test("storage lifecycle helpers detect replacements and cleanup stored objects", async () => {
  const removed: string[][] = [];
  const supabase = {
    storage: {
      from(bucket: string) {
        return {
          upload: async () => ({ error: null }),
          remove: async (paths: string[]) => {
            removed.push([bucket, ...paths]);
            return { error: null };
          },
        };
      },
    },
  };

  assert.equal(sameStorageObject({ bucket: "documents", path: "a.pdf" }, { bucket: "documents", path: "a.pdf" }), true);
  assert.equal(sameStorageObject({ bucket: "documents", path: "a.pdf" }, { bucket: "documents", path: "b.pdf" }), false);
  assert.equal(await removeStoredObject(supabase, { bucket: "documents", path: "a.pdf" }), true);
  assert.equal(await removeStoredObjects(supabase, [{ bucket: "documents", path: "a.pdf" }, { bucket: "documents", path: "b.pdf" }, { bucket: "documents", path: "b.pdf" }, { bucket: "payment-proofs", path: "proof.pdf" }]), true);
  assert.deepEqual(removed, [["documents", "a.pdf"], ["documents", "a.pdf", "b.pdf"], ["payment-proofs", "proof.pdf"]]);
});

test("booking delete flow prefetches related documents before cascading database delete", () => {
  const actions = readFileSync("app/admin/(protected)/operations/actions.ts", "utf8");

  assert.match(actions, /async function getBookingDocumentFiles\(id: string\)/);
  assert.match(actions, /from\("documents"\)\.select\("bucket, path"\)\.eq\("booking_id", id\)/);
  assert.match(actions, /const \{ supabase, files \} = await getBookingDocumentFiles\(id!\);/);
  assert.match(actions, /from\("bookings"\)\.delete\(\)\.eq\("id", id\)/);
  assert.match(actions, /await removeStoredObjects\(supabase, files\)/);
  assert.match(actions, /console\.error\("\[bookings\] deleted documents cleanup failed"/);
});

test("admin upload UX hides manual paths and keeps role gates without service-role imports", () => {
  const actions = readFileSync("app/admin/(protected)/operations/actions.ts", "utf8");
  const documents = readFileSync("app/admin/(protected)/operations/documents/page.tsx", "utf8");
  const payments = readFileSync("app/admin/(protected)/payments/page.tsx", "utf8");
  const helper = readFileSync("lib/admin/storage-uploads.ts", "utf8");
  const combined = [actions, documents, payments, helper].join("\n");

  assert.match(actions, /requireAdminRole\(\["admin", "operaciones"\]\)/);
  assert.match(actions, /requireAdminRole\(\["admin", "finanzas"\]\)/);
  assert.match(documents, /name="document_file"/);
  assert.match(payments, /name="proof_file"/);
  assert.doesNotMatch(documents, /name="bucket"|name="path"/);
  assert.doesNotMatch(payments, /name="proof_bucket"|name="proof_path"/);
  assert.match(actions, /uploadPrivateFile\(supabase, "documents"/);
  assert.match(actions, /uploadPrivateFile\(supabase, "payment-proofs"/);
  assert.match(actions, /removeStoredObject\(supabase, existing\.file\)/);
  assert.match(actions, /removeStoredObject\(supabase, file\)/);
  assert.match(documents, /Reemplazar archivo \(opcional\)/);
  assert.doesNotMatch(combined, /service-role|SUPABASE_SECRET_KEY|createServiceRoleClient|@\/lib\/supabase\/service/);
});

test("storage policies align private buckets to their owning admin roles", () => {
  const migration = readFileSync("db/migrations/0017_narrow_private_storage_roles.sql", "utf8");

  assert.match(migration, /bucket_id = 'documents'\s+and \(public\.is_admin\(\) or public\.has_role\('operaciones'\)\)/);
  assert.match(migration, /bucket_id = 'payment-proofs'\s+and \(public\.is_admin\(\) or public\.has_role\('finanzas'\)\)/);
  assert.doesNotMatch(migration, /bucket_id in \('documents', 'payment-proofs'\)/);
  assert.doesNotMatch(migration, /bucket_id = 'documents'[\s\S]{0,120}has_role\('finanzas'\)/);
  assert.doesNotMatch(migration, /bucket_id = 'payment-proofs'[\s\S]{0,120}has_role\('operaciones'\)/);
});
