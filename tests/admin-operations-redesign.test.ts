import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  bookingAmountLabel,
  bookingDateRangeLabel,
  bookingDisplayName,
  contactDisplayName,
  documentStatusLabel,
  documentTypeLabel,
  filterBookings,
  filterDocuments,
  filterPayments,
  paymentStatusLabel,
  paymentTypeLabel,
} from "@/lib/admin/operations-view";
import { getOperationActionErrorMessage } from "@/lib/admin/operation-action-errors";
import { requiredTextFromOperationFormData } from "@/lib/admin/operation-action-errors";
import { captureDialogLifecycleState, resolveDialogKeyAction, restoreDialogLifecycleState } from "@/lib/admin/operation-dialog";
import { buildPrivateFileInputAccessibility, clearPrivateFileSelection, validatePrivateFileSelection } from "@/lib/admin/private-file-input";

test("operations view helpers format Spanish-safe labels and booking summaries", () => {
  assert.equal(contactDisplayName({ first_name: "Ada", last_name: "Lovelace", email: null, phone: null }), "Ada Lovelace");
  assert.equal(bookingDisplayName({ id: "booking-internal-secret", booking_code: null, status: "confirmed" }), "Reserva sin código");
  assert.equal(paymentTypeLabel("deposit"), "Anticipo");
  assert.equal(paymentStatusLabel("verified"), "Verificado");
  assert.equal(documentTypeLabel("passport"), "Pasaporte");
  assert.equal(documentTypeLabel("supplier_manifest_internal"), "Documento operativo");
  assert.equal(documentStatusLabel("active"), "Activo");
  assert.equal(bookingAmountLabel({ total_mxn: 12500, total_usd: null, currency: "MXN" }), "MXN 12,500.00");
  assert.match(bookingDateRangeLabel({ starts_on: "2026-08-10", ends_on: "2026-08-16" }), /10\/8\/2026.+16\/8\/2026/);
});

test("bookingDisplayName never leaks internal identifiers when booking_code is missing", () => {
  const label = bookingDisplayName({ id: "6d2fb7aa-4de2-4be3-bf4b-secret", booking_code: "   ", status: "draft" });

  assert.equal(label, "Reserva sin código");
  assert.doesNotMatch(label, /6d2fb7aa|secret|draft/i);
});

test("dialog interaction helpers preserve Escape close, focus restore, body scroll policy, and tab wrapping", () => {
  let restoreCalls = 0;
  const trigger = { isConnected: true, focus: () => { restoreCalls += 1; } };
  const lifecycle = captureDialogLifecycleState({
    activeElement: null,
    triggerElement: trigger,
    originalOverflow: "auto",
  });

  assert.equal(lifecycle.originalOverflow, "auto");
  assert.equal(lifecycle.lastFocusedElement, trigger);

  const escapeAction = resolveDialogKeyAction({ key: "Escape", shiftKey: false, focusableCount: 3, activeIndex: 1 });
  assert.deepEqual(escapeAction, { close: true, preventDefault: true, focusTarget: null });

  assert.deepEqual(resolveDialogKeyAction({ key: "Tab", shiftKey: true, focusableCount: 3, activeIndex: 0 }), {
    close: false,
    preventDefault: true,
    focusTarget: "last",
  });
  assert.deepEqual(resolveDialogKeyAction({ key: "Tab", shiftKey: false, focusableCount: 3, activeIndex: 2 }), {
    close: false,
    preventDefault: true,
    focusTarget: "first",
  });
  assert.deepEqual(resolveDialogKeyAction({ key: "Tab", shiftKey: false, focusableCount: 0, activeIndex: -1 }), {
    close: false,
    preventDefault: true,
    focusTarget: null,
  });

  const restored = restoreDialogLifecycleState(lifecycle);
  assert.equal(restored.bodyOverflow, "auto");
  assert.equal(restored.restoredFocus, true);
  assert.equal(restoreCalls, 1);
});

test("private file helpers validate type and size, expose selected metadata, and clear safely", () => {
  const accept = "application/pdf,image/jpeg,image/png,image/webp";

  assert.deepEqual(validatePrivateFileSelection({
    accept,
    file: { name: "comprobante.pdf", size: 240 * 1024, type: "application/pdf" },
    maxSizeBytes: 2 * 1024 * 1024,
  }), {
    error: null,
    selectedFile: { name: "comprobante.pdf", sizeLabel: "240 KB" },
    shouldClearInput: false,
    valid: true,
  });

  const invalidType = validatePrivateFileSelection({
    accept,
    file: { name: "comprobante.exe", size: 50 * 1024, type: "application/octet-stream" },
    maxSizeBytes: 2 * 1024 * 1024,
  });
  assert.equal(invalidType.valid, false);
  assert.equal(invalidType.selectedFile, null);
  assert.equal(invalidType.shouldClearInput, true);
  assert.match(invalidType.error ?? "", /Tipo de archivo no permitido/);

  const oversize = validatePrivateFileSelection({
    accept,
    file: { name: "comprobante.png", size: 3 * 1024 * 1024, type: "image/png" },
    maxSizeBytes: 2 * 1024 * 1024,
  });
  assert.equal(oversize.valid, false);
  assert.equal(oversize.selectedFile, null);
  assert.match(oversize.error ?? "", /2 MB/);

  assert.deepEqual(clearPrivateFileSelection(), {
    error: null,
    selectedFile: null,
    shouldClearInput: true,
  });
});

test("operation action error mapping returns stable Spanish messages without leaking backend details", () => {
  assert.equal(getOperationActionErrorMessage("payment-load-proof"), "No se pudo consultar el comprobante actual. Intenta nuevamente.");
  assert.equal(getOperationActionErrorMessage("payment-save"), "No se pudo guardar el pago. Revisa la información e inténtalo nuevamente.");
  assert.equal(getOperationActionErrorMessage("payment-delete"), "No se pudo eliminar el pago. Intenta nuevamente.");
  assert.equal(getOperationActionErrorMessage("booking-save"), "No se pudo guardar la reserva. Revisa la información e inténtalo nuevamente.");
  assert.equal(getOperationActionErrorMessage("booking-delete"), "No se pudo eliminar la reserva. Intenta nuevamente.");
  assert.equal(getOperationActionErrorMessage("booking-load-documents"), "No se pudieron consultar los documentos vinculados a la reserva. Intenta nuevamente.");
  assert.equal(getOperationActionErrorMessage("document-load-file"), "No se pudo consultar el documento actual. Intenta nuevamente.");
  assert.equal(getOperationActionErrorMessage("document-save"), "No se pudo guardar el documento. Revisa la información e inténtalo nuevamente.");
  assert.equal(getOperationActionErrorMessage("document-delete"), "No se pudo eliminar el documento. Intenta nuevamente.");

  for (const context of [
    "payment-load-proof",
    "payment-save",
    "payment-delete",
    "booking-save",
    "booking-delete",
    "booking-load-documents",
    "document-load-file",
    "document-save",
    "document-delete",
  ] as const) {
    assert.doesNotMatch(getOperationActionErrorMessage(context), /duplicate key|storage\.objects|constraint|proof_path|token|sql/i);
  }
});

test("required operation form fields throw safe Spanish messages without leaking field keys", () => {
  const bookingFormData = new FormData();
  bookingFormData.set("contact_id", "   ");

  assert.throws(
    () => requiredTextFromOperationFormData(bookingFormData, "contact_id", "booking-save"),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "No se pudo guardar la reserva. Revisa la información e inténtalo nuevamente.");
      assert.doesNotMatch(error.message, /contact_id|required|backend|sql|supabase/i);
      return true;
    },
  );

  const deleteFormData = new FormData();

  assert.throws(
    () => requiredTextFromOperationFormData(deleteFormData, "id", "payment-delete"),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "No se pudo eliminar el pago. Intenta nuevamente.");
      assert.doesNotMatch(error.message, /\bid\b|required|storage|token|backend/i);
      return true;
    },
  );
});

test("private file accessibility helper wires stable ids and input descriptions for help and error text", () => {
  assert.deepEqual(buildPrivateFileInputAccessibility({ error: null, hasReplacementHelpText: false, inputId: "proof-file" }), {
    errorId: "proof-file-error",
    helpId: "proof-file-help",
    inputDescribedBy: "proof-file-help",
    inputInvalid: false,
    replacementHelpId: "proof-file-replacement-help",
  });

  assert.deepEqual(buildPrivateFileInputAccessibility({ error: "Archivo inválido", hasReplacementHelpText: true, inputId: "proof-file" }), {
    errorId: "proof-file-error",
    helpId: "proof-file-help",
    inputDescribedBy: "proof-file-help proof-file-replacement-help proof-file-error",
    inputInvalid: true,
    replacementHelpId: "proof-file-replacement-help",
  });
});

test("operations filters preserve supported query semantics across payments, bookings, and documents", () => {
  const payments = [
    {
      amount: 1500,
      booking_id: "booking-1",
      contacts: { first_name: "Ada", last_name: null, email: "ada@example.com", phone: null },
      created_at: "2026-07-10T12:00:00.000Z",
      currency: "MXN",
      lead_id: null,
      leads: null,
      method_id: "method-transfer",
      paid_at: "2026-07-11T12:00:00.000Z",
      payment_methods: { label_es: "Transferencia" },
      payment_type: "deposit",
      status: "received",
      contact_id: "contact-1",
      bookings: { id: "booking-1", booking_code: "AC-001", status: "confirmed" },
    },
    {
      amount: 700,
      booking_id: null,
      contacts: { first_name: "Grace", last_name: null, email: null, phone: null },
      created_at: "2026-07-12T12:00:00.000Z",
      currency: "USD",
      lead_id: "lead-2",
      leads: { id: "lead-2", summary: "Seguimiento VIP", contacts: null },
      method_id: "method-card",
      paid_at: null,
      payment_methods: { label_es: "Tarjeta" },
      payment_type: "balance",
      status: "verified",
      contact_id: "contact-2",
      bookings: null,
    },
  ];

  assert.equal(filterPayments(payments, { q: "transferencia", reconciliation: "pending" }).length, 1);
  assert.equal(filterPayments(payments, { relation: "lead", status: "verified", currency: "USD" }).length, 1);

  const bookings = [
    {
      assigned_to: "advisor-1",
      booking_code: "AC-100",
      contacts: { first_name: "Ada", last_name: null, email: null, phone: null },
      destination_id: "dest-1",
      destinations: { name_es: "Riviera Maya" },
      ends_on: "2026-09-14",
      leads: null,
      profiles: { full_name: "Sofía" },
      starts_on: "2026-09-10",
      status: "confirmed",
    },
    {
      assigned_to: null,
      booking_code: "AC-101",
      contacts: { first_name: "Grace", last_name: null, email: null, phone: null },
      destination_id: "dest-2",
      destinations: { name_es: "Madrid" },
      ends_on: "2026-09-20",
      leads: null,
      profiles: null,
      starts_on: "2026-09-18",
      status: "draft",
    },
  ];

  assert.equal(filterBookings(bookings, { q: "sofía", status: "confirmed" }).length, 1);
  assert.equal(filterBookings(bookings, { advisor: "unassigned", destination: "dest-2" }).length, 1);

  const documents = [
    {
      booking_id: "booking-1",
      bookings: { id: "booking-1", booking_code: "AC-001", status: "confirmed" },
      contact_id: "contact-1",
      contacts: { first_name: "Ada", last_name: null, email: null, phone: null },
      created_at: "2026-07-15T12:00:00.000Z",
      document_type: "voucher",
      lead_id: null,
      leads: null,
      status: "active",
      title: "Voucher hotel",
    },
    {
      booking_id: null,
      bookings: null,
      contact_id: null,
      contacts: null,
      created_at: "2026-07-01T12:00:00.000Z",
      document_type: "contract",
      lead_id: "lead-1",
      leads: { id: "lead-1", summary: "Europa", contacts: null },
      status: "draft",
      title: "Contrato Europa",
    },
  ];

  assert.equal(filterDocuments(documents, { relation: "booking", type: "voucher" }).length, 1);
  assert.equal(filterDocuments(documents, { q: "europa", status: "draft" }).length, 1);
});

test("phase 3 admin operations pages use shared primitives, modal flows, and safe file inputs without explicit form encoding", () => {
  const paymentsPage = readFileSync("app/admin/(protected)/payments/page.tsx", "utf8");
  const bookingsPage = readFileSync("app/admin/(protected)/operations/bookings/page.tsx", "utf8");
  const documentsPage = readFileSync("app/admin/(protected)/operations/documents/page.tsx", "utf8");
  const dialogComponent = readFileSync("components/admin/operations/operation-dialog.tsx", "utf8");
  const fileInputComponent = readFileSync("components/admin/operations/private-file-input.tsx", "utf8");

  assert.match(paymentsPage, /<PageHeader/);
  assert.match(bookingsPage, /<PageHeader/);
  assert.match(documentsPage, /<PageHeader/);
  assert.match(paymentsPage, /<OperationDialog/);
  assert.match(bookingsPage, /<OperationDialog/);
  assert.match(documentsPage, /<OperationDialog/);
  assert.match(paymentsPage, /name="proof_file"/);
  assert.match(documentsPage, /name="document_file"/);
  assert.match(documentsPage, /Reemplazar archivo \(opcional\)/);
  assert.match(dialogComponent, /role="dialog"/);
  assert.match(dialogComponent, /resolveDialogKeyAction/);
  assert.match(dialogComponent, /document\.body\.style\.overflow = "hidden"/);
  assert.match(dialogComponent, /restoreDialogLifecycleState/);
  assert.match(fileInputComponent, /Arrastra tu archivo aquí o selecciónalo manualmente/);
  assert.match(fileInputComponent, /validatePrivateFileSelection/);
  assert.match(fileInputComponent, /buildPrivateFileInputAccessibility/);
  assert.match(fileInputComponent, /clearPrivateFileSelection/);
  assert.match(fileInputComponent, /aria-describedby=/);
  assert.match(fileInputComponent, /aria-invalid=/);
  assert.match(fileInputComponent, /id=\{a11y\.helpId\}/);
  assert.match(fileInputComponent, /id=\{a11y\.replacementHelpId\}/);
  assert.match(fileInputComponent, /id=\{a11y\.errorId\}/);
  assert.doesNotMatch(paymentsPage, /encType=|method=/);
  assert.doesNotMatch(documentsPage, /encType=|method=/);
  assert.doesNotMatch([paymentsPage, bookingsPage, documentsPage].join("\n"), /name="proof_bucket"|name="proof_path"|name="bucket"|name="path"|name="document_preview_url"|name="document_download_url"/);
});
