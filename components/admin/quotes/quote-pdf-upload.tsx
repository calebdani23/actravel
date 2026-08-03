"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { beginQuotePdfUploadAction, failQuotePdfUploadAction, finalizeQuotePdfUploadAction } from "@/app/admin/(protected)/quotes/actions";
import { initialQuoteActionState, type QuotePdfIntentDescriptor, type QuotePdfSagaActionState } from "@/app/admin/(protected)/quotes/action-state";
import { adminFieldHintClassName, adminInputClassName } from "@/components/admin/admin-primitives";
import { validateQuotePdfInBrowser } from "@/lib/admin/quote-pdf-client";
import { isDeterministicQuotePdfUploadError, quotePdfTusErrorStatus, QuotePdfUploadCancelledError, removeFailedQuotePdfObject, uploadQuotePdfWithTus } from "@/lib/admin/quote-pdf-tus";
import { createQuoteIdempotencyKey } from "@/lib/admin/quote-validation";

export function QuotePdfUpload({ quoteId, quoteVersionId, disabled = false }: Readonly<{ quoteId: string; quoteVersionId: string; disabled?: boolean }>) {
  const router = useRouter();
  const [state, setState] = useState<QuotePdfSagaActionState>(initialQuoteActionState);
  const [pending, setPending] = useState(false);
  const [phase, setPhase] = useState<"idle" | "validating" | "beginning" | "uploading" | "uploaded" | "finalizing" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [intent, setIntent] = useState<QuotePdfIntentDescriptor | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => createQuoteIdempotencyKey("quote_pdf"));
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const error = state.fieldErrors.pdf?.[0] ?? null;

  useEffect(() => () => abortRef.current?.abort(), []);

  function resetFailedUpload() {
    setIntent(null);
    setFile(null);
    setProgress(0);
    setPhase("idle");
    setIdempotencyKey(createQuoteIdempotencyKey("quote_pdf"));
    setState(initialQuoteActionState);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function finalize(target: QuotePdfIntentDescriptor) {
    setPhase("finalizing");
    const result = await finalizeQuotePdfUploadAction(target.intentId);
    setState(result);
    if (result.ok) {
      setIntent({ ...target, intentStatus: "finalized" });
      router.refresh();
      return;
    }
    if (result.intent) setIntent(result.intent);
    if (result.cleanupAllowed) {
      await removeFailedQuotePdfObject(target.bucket, target.path);
      setPhase("failed");
    } else {
      setPhase("uploaded");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || disabled) return;
    if (!file) {
      setState({ ok: false, message: "Selecciona un archivo PDF.", fieldErrors: { pdf: ["El PDF es obligatorio para esta carga."] } });
      return;
    }
    setPending(true);
    try {
      if (phase === "uploaded" && intent) {
        await finalize(intent);
        return;
      }
      setPhase("validating");
      const metadata = await validateQuotePdfInBrowser(file);
      let target = intent;
      if (!target || target.intentStatus !== "pending") {
        setPhase("beginning");
        const begun = await beginQuotePdfUploadAction({ quoteId, quoteVersionId, expectedSizeBytes: metadata.byteSize, idempotencyKey });
        setState(begun);
        if (!begun.ok || !begun.intent) {
          setPhase("failed");
          return;
        }
        target = begun.intent;
        setIntent(target);
      }
      setPhase("uploading");
      const abortController = new AbortController();
      abortRef.current = abortController;
      try {
        await uploadQuotePdfWithTus({
          advisorySha256: metadata.sha256,
          bucket: target.bucket,
          file,
          intentId: target.intentId,
          path: target.path,
          signal: abortController.signal,
          onProgress: (uploadedBytes, totalBytes) => setProgress(totalBytes ? Math.round((uploadedBytes / totalBytes) * 100) : 0),
        });
      } catch (uploadError) {
        if (uploadError instanceof QuotePdfUploadCancelledError) {
          setState({ ok: false, message: uploadError.message, fieldErrors: {}, intent: target });
          setPhase("idle");
          return;
        }
        if (quotePdfTusErrorStatus(uploadError) === 409) {
          setPhase("uploaded");
          await finalize(target);
          return;
        }
        if (isDeterministicQuotePdfUploadError(uploadError)) {
          const failed = await failQuotePdfUploadAction(target.intentId, "upload_rejected");
          setState(failed);
          if (failed.cleanupAllowed) await removeFailedQuotePdfObject(target.bucket, target.path);
          setIntent({ ...target, intentStatus: "failed" });
          setPhase("failed");
          return;
        }
        setState({ ok: false, message: "La conexión se interrumpió. Conservamos la carga para reanudarla.", fieldErrors: {}, intent: target });
        setPhase("idle");
        return;
      } finally {
        abortRef.current = null;
      }
      setProgress(100);
      setPhase("uploaded");
      await finalize(target);
    } catch (caught) {
      const message = caught instanceof Error && /^La cotización|^El PDF|^El archivo/.test(caught.message) ? caught.message : "No se pudo preparar el PDF para la carga.";
      setState({ ok: false, message, fieldErrors: { pdf: [message] }, intent: intent ?? undefined });
      setPhase(intent ? "idle" : "failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form aria-describedby="quote-pdf-guidance quote-pdf-status quote-pdf-progress" className="space-y-4" onSubmit={submit}>
      {state.message ? (
        <div className={state.ok ? "rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" : "rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"} id="quote-pdf-status" role={state.ok ? "status" : "alert"}>
          {state.message}
        </div>
      ) : null}
      <label className="space-y-2" htmlFor="quote-pdf-file">
        <span className="text-sm font-medium">PDF canónico</span>
        <input
          accept="application/pdf,.pdf"
          aria-describedby={["quote-pdf-guidance", error ? "quote-pdf-error" : ""].filter(Boolean).join(" ")}
          className={`${adminInputClassName} h-auto py-2.5 file:mr-3 file:rounded-md file:border-0 file:bg-[color:var(--admin-surface-muted)] file:px-3 file:py-2 file:text-sm file:font-medium`}
          disabled={disabled || pending || Boolean(intent)}
          id="quote-pdf-file"
          name="pdf"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          ref={fileInputRef}
          required
          type="file"
        />
        <p className={adminFieldHintClassName} id="quote-pdf-guidance">Solo PDF, máximo 20 MB. La carga resumible va directo a Storage; el servidor descarga y valida los bytes antes de finalizar.</p>
        {error ? <p className="text-xs font-medium text-red-700" id="quote-pdf-error">{error}</p> : null}
      </label>
      {phase === "uploading" || progress > 0 ? <div className="space-y-2" id="quote-pdf-progress" role="status"><div className="flex justify-between text-sm"><span>Progreso de carga</span><span>{progress}%</span></div><progress aria-label="Progreso de carga del PDF" className="h-2 w-full" max={100} value={progress}>{progress}%</progress></div> : null}
      <div className="flex flex-wrap gap-3">
        <button className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[color:var(--admin-accent)] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={disabled || pending || !file} type="submit">
          {phase === "validating" ? "Validando PDF..." : phase === "beginning" ? "Reservando carga..." : phase === "uploading" ? "Subiendo PDF..." : phase === "finalizing" ? "Finalizando PDF..." : phase === "uploaded" ? "Reintentar finalización" : "Subir PDF"}
        </button>
        {phase === "uploading" ? <button className="min-h-11 rounded-lg border border-[color:var(--admin-border)] bg-white px-4 text-sm font-semibold" onClick={() => abortRef.current?.abort()} type="button">Cancelar carga</button> : null}
        {phase === "failed" && intent?.intentStatus === "failed" ? <button className="min-h-11 rounded-lg border border-[color:var(--admin-border)] bg-white px-4 text-sm font-semibold" onClick={resetFailedUpload} type="button">Elegir otro PDF</button> : null}
      </div>
    </form>
  );
}
