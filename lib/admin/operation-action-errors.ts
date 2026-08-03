export type OperationActionErrorContext =
  | "payment-load-proof"
  | "payment-save"
  | "payment-delete"
  | "booking-save"
  | "booking-delete"
  | "booking-load-documents"
  | "document-load-file"
  | "document-quote-linked"
  | "document-save"
  | "document-delete";

const OPERATION_ACTION_ERROR_MESSAGES: Record<OperationActionErrorContext, string> = {
  "payment-load-proof": "No se pudo consultar el comprobante actual. Intenta nuevamente.",
  "payment-save": "No se pudo guardar el pago. Revisa la información e inténtalo nuevamente.",
  "payment-delete": "No se pudo eliminar el pago. Intenta nuevamente.",
  "booking-save": "No se pudo guardar la reserva. Revisa la información e inténtalo nuevamente.",
  "booking-delete": "No se pudo eliminar la reserva. Intenta nuevamente.",
  "booking-load-documents": "No se pudieron consultar los documentos vinculados a la reserva. Intenta nuevamente.",
  "document-load-file": "No se pudo consultar el documento actual. Intenta nuevamente.",
  "document-quote-linked": "Los PDF de cotizaciones se administran únicamente desde Cotizaciones.",
  "document-save": "No se pudo guardar el documento. Revisa la información e inténtalo nuevamente.",
  "document-delete": "No se pudo eliminar el documento. Intenta nuevamente.",
};

export function getOperationActionErrorMessage(context: OperationActionErrorContext) {
  return OPERATION_ACTION_ERROR_MESSAGES[context];
}

export function textFromOperationFormData(formData: FormData, key: string) {
  const value = formData.get(key);
  const result = typeof value === "string" ? value.trim() : "";
  return result || null;
}

export function requiredTextFromOperationFormData(
  formData: FormData,
  key: string,
  context: OperationActionErrorContext,
) {
  const result = textFromOperationFormData(formData, key);
  if (!result) throwOperationActionError(context, new Error(`${key} is required`));
  return result;
}

export function throwOperationActionError(context: OperationActionErrorContext, error: unknown): never {
  console.error("[admin-operations] action failed", { context, error });
  throw new Error(getOperationActionErrorMessage(context));
}
