"use client";

import { useActionState, useDeferredValue, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addQuoteVersionAction, beginQuoteRegistrationAction, failQuoteRegistrationAction, finalizeQuoteRegistrationAction } from "@/app/admin/(protected)/quotes/actions";
import { initialQuoteActionState, type BeginQuoteRegistrationInput, type QuoteActionState, type QuotePdfIntentDescriptor, type QuotePdfSagaActionState } from "@/app/admin/(protected)/quotes/action-state";
import { adminFieldHintClassName, adminInputClassName, adminSelectClassName } from "@/components/admin/admin-primitives";
import { validateQuotePdfInBrowser } from "@/lib/admin/quote-pdf-client";
import { isDeterministicQuotePdfUploadError, quotePdfTusErrorStatus, QuotePdfUploadCancelledError, removeFailedQuotePdfObject, uploadQuotePdfWithTus } from "@/lib/admin/quote-pdf-tus";
import { createQuoteIdempotencyKey } from "@/lib/admin/quote-validation";
import type { QuoteContactOption, QuoteOpportunityOption, QuoteRequestOption, QuoteVersionSummaryDto } from "@/lib/admin/quotes";

function firstError(state: QuoteActionState, field: string) {
  return state.fieldErrors[field]?.[0] ?? null;
}

function FieldError({ id, message }: Readonly<{ id: string; message: string | null }>) {
  return message ? <p className="text-xs font-medium text-red-700" id={id}>{message}</p> : null;
}

function ActionMessage({ state, id }: Readonly<{ state: QuoteActionState; id: string }>) {
  if (!state.message) return null;
  return (
    <div className={state.ok ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"} id={id} role={state.ok ? "status" : "alert"}>
      {state.message}
    </div>
  );
}

function CommercialFields({ disabled, state, idPrefix }: Readonly<{ disabled: boolean; state: QuoteActionState; idPrefix: string }>) {
  return (
    <fieldset className="grid gap-4 border-0 p-0 sm:grid-cols-2" disabled={disabled}>
      <legend className="sr-only">Contenido comercial de la cotización</legend>
      <label className="space-y-2 sm:col-span-2" htmlFor={`${idPrefix}-title`}>
        <span className="text-sm font-medium">Título</span>
        <input aria-describedby={firstError(state, "title") ? `${idPrefix}-title-error` : undefined} className={adminInputClassName} id={`${idPrefix}-title`} maxLength={120} name="title" required />
        <FieldError id={`${idPrefix}-title-error`} message={firstError(state, "title")} />
      </label>
      <label className="space-y-2 sm:col-span-2" htmlFor={`${idPrefix}-summary`}>
        <span className="text-sm font-medium">Resumen comercial</span>
        <textarea className={`${adminInputClassName} min-h-24 py-3`} id={`${idPrefix}-summary`} maxLength={400} name="summary" />
      </label>
      <label className="space-y-2" htmlFor={`${idPrefix}-currency`}>
        <span className="text-sm font-medium">Moneda</span>
        <select aria-describedby={firstError(state, "currency") ? `${idPrefix}-currency-error` : undefined} className={adminSelectClassName} defaultValue="MXN" id={`${idPrefix}-currency`} name="currency" required>
          <option value="MXN">MXN</option>
          <option value="USD">USD</option>
        </select>
        <FieldError id={`${idPrefix}-currency-error`} message={firstError(state, "currency")} />
      </label>
      <label className="space-y-2" htmlFor={`${idPrefix}-valid-until`}>
        <span className="text-sm font-medium">Vigencia</span>
        <input aria-describedby={firstError(state, "validUntil") ? `${idPrefix}-valid-until-error` : undefined} className={adminInputClassName} id={`${idPrefix}-valid-until`} name="validUntil" type="date" />
        <FieldError id={`${idPrefix}-valid-until-error`} message={firstError(state, "validUntil")} />
      </label>
      <label className="space-y-2" htmlFor={`${idPrefix}-total`}>
        <span className="text-sm font-medium">Total</span>
        <input aria-describedby={firstError(state, "totalAmount") ? `${idPrefix}-total-error` : undefined} className={adminInputClassName} id={`${idPrefix}-total`} min="0" name="totalAmount" step="0.01" type="number" />
        <FieldError id={`${idPrefix}-total-error`} message={firstError(state, "totalAmount")} />
      </label>
      <label className="space-y-2" htmlFor={`${idPrefix}-deposit`}>
        <span className="text-sm font-medium">Anticipo</span>
        <input aria-describedby={firstError(state, "depositAmount") ? `${idPrefix}-deposit-error` : undefined} className={adminInputClassName} id={`${idPrefix}-deposit`} min="0" name="depositAmount" step="0.01" type="number" />
        <FieldError id={`${idPrefix}-deposit-error`} message={firstError(state, "depositAmount")} />
      </label>
      <label className="space-y-2 sm:col-span-2" htmlFor={`${idPrefix}-notes`}>
        <span className="text-sm font-medium">Notas internas</span>
        <textarea className={`${adminInputClassName} min-h-28 py-3`} id={`${idPrefix}-notes`} maxLength={2000} name="notes" />
      </label>
    </fieldset>
  );
}

type QuoteCreateFormProps = {
  contacts: QuoteContactOption[];
  opportunities: QuoteOpportunityOption[];
  requests: QuoteRequestOption[];
  initialContactId?: string | null;
  initialOpportunityId?: string | null;
  initialRequestId?: string | null;
  optionsArePartial?: boolean;
};

export function QuoteCreateForm(props: Readonly<QuoteCreateFormProps>) {
  const searchParams = useSearchParams();
  const contactId = props.initialContactId ?? searchParams.get("contactId") ?? "";
  const opportunityId = props.initialOpportunityId ?? searchParams.get("opportunityId") ?? "";
  const requestId = props.initialRequestId ?? searchParams.get("requestId") ?? "";
  return <QuoteCreateFormScope {...props} initialContactId={contactId} initialOpportunityId={opportunityId} initialRequestId={requestId} key={`${contactId}:${opportunityId}:${requestId}`} />;
}

function QuoteCreateFormScope({ contacts, opportunities, requests, initialContactId, initialOpportunityId, initialRequestId, optionsArePartial = false }: Readonly<QuoteCreateFormProps>) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<QuotePdfSagaActionState>(initialQuoteActionState);
  const [pending, setPending] = useState(false);
  const [phase, setPhase] = useState<"idle" | "validating" | "beginning" | "uploading" | "uploaded" | "finalizing" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [intent, setIntent] = useState<QuotePdfIntentDescriptor | null>(null);
  const [reservedInput, setReservedInput] = useState<BeginQuoteRegistrationInput | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => createQuoteIdempotencyKey("quote_registration"));
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [contactId, setContactId] = useState(initialContactId ?? "");
  const [opportunityId, setOpportunityId] = useState(initialOpportunityId ?? "");
  const [requestId, setRequestId] = useState(initialRequestId ?? "");
  const [contactSearch, setContactSearch] = useState(() => searchParams.get("contactQuery") ?? "");
  const [, startNavigation] = useTransition();
  const deferredContactSearch = useDeferredValue(contactSearch.trim().toLocaleLowerCase("es"));
  const visibleContacts = contacts.filter((contact) => !deferredContactSearch || [contact.name, contact.email, contact.phone].some((value) => value?.toLocaleLowerCase("es").includes(deferredContactSearch)));
  const visibleOpportunities = opportunities.filter((opportunity) => opportunity.contactId === contactId);
  const visibleRequests = requests.filter((request) => request.contactId === contactId && request.opportunityId === opportunityId);

  useEffect(() => {
    const current = searchParams.get("contactQuery") ?? "";
    if (current === deferredContactSearch) return;
    const next = new URLSearchParams(searchParams);
    if (deferredContactSearch) next.set("contactQuery", deferredContactSearch);
    else next.delete("contactQuery");
    next.delete("contactPage");
    startNavigation(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }, [deferredContactSearch, pathname, router, searchParams]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function replaceSelection(nextContactId: string, nextOpportunityId: string, nextRequestId: string) {
    const next = new URLSearchParams(searchParams);
    if (nextContactId) next.set("contactId", nextContactId); else next.delete("contactId");
    if (nextOpportunityId) next.set("opportunityId", nextOpportunityId); else next.delete("opportunityId");
    if (nextRequestId) next.set("requestId", nextRequestId); else next.delete("requestId");
    startNavigation(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  function changeContact(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextContactId = event.target.value;
    setContactId(nextContactId);
    setOpportunityId("");
    setRequestId("");
    replaceSelection(nextContactId, "", "");
  }

  function changeOpportunity(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextOpportunityId = event.target.value;
    setOpportunityId(nextOpportunityId);
    setRequestId("");
    replaceSelection(contactId, nextOpportunityId, "");
  }

  function changeContactSearch(event: React.ChangeEvent<HTMLInputElement>) {
    setContactSearch(event.target.value);
  }

  function changeRequest(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextRequestId = event.target.value;
    setRequestId(nextRequestId);
    replaceSelection(contactId, opportunityId, nextRequestId);
  }

  function changePdf(event: React.ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setState(initialQuoteActionState);
  }

  function resetFailedRegistration() {
    setIntent(null);
    setReservedInput(null);
    setFile(null);
    setProgress(0);
    setPhase("idle");
    setIdempotencyKey(createQuoteIdempotencyKey("quote_registration"));
    setState(initialQuoteActionState);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function finalizeRegistration(target: QuotePdfIntentDescriptor) {
    setPhase("finalizing");
    const result = await finalizeQuoteRegistrationAction(target.intentId);
    setState(result);
    if (result.ok && result.quoteId) {
      startNavigation(() => router.push(`/admin/quotes/${result.quoteId}?created=1`));
      return true;
    }
    if (result.intent) setIntent(result.intent);
    if (result.cleanupAllowed) {
      await removeFailedQuotePdfObject(target.bucket, target.path);
      setPhase("failed");
    } else {
      setPhase("uploaded");
    }
    return false;
  }

  async function submitRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    const value = (name: string) => String(formData.get(name) ?? "").trim();
    const formValues = {
      contactId: value("contactId"),
      opportunityId: value("opportunityId"),
      originatingRequestId: value("originatingRequestId") || undefined,
      title: value("title"),
      summary: value("summary") || undefined,
      currency: value("currency"),
      totalAmount: value("totalAmount") || undefined,
      depositAmount: value("depositAmount") || undefined,
      validUntil: value("validUntil") || undefined,
      notes: value("notes") || undefined,
    };
    if (!file) {
      setState({ ok: false, message: "Selecciona el PDF inicial de la cotización.", fieldErrors: { pdf: ["El PDF es obligatorio."] } });
      return;
    }
    setPending(true);
    try {
      if (phase === "uploaded" && intent) {
        await finalizeRegistration(intent);
        return;
      }
      setPhase("validating");
      const metadata = await validateQuotePdfInBrowser(file);
      const nextInput: BeginQuoteRegistrationInput = reservedInput ?? {
        ...formValues,
        expectedSizeBytes: metadata.byteSize,
        advisorySha256: metadata.sha256,
        idempotencyKey,
      };
      let target = intent;
      if (!target || target.intentStatus !== "pending") {
        setPhase("beginning");
        const begun = await beginQuoteRegistrationAction(nextInput);
        setState(begun);
        if (!begun.ok || !begun.intent) {
          setPhase("failed");
          return;
        }
        target = begun.intent;
        setIntent(target);
        setReservedInput(nextInput);
      }
      if (target.intentStatus === "finalized") {
        await finalizeRegistration(target);
        return;
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
      } catch (error) {
        if (error instanceof QuotePdfUploadCancelledError) {
          setState({ ok: false, message: error.message, fieldErrors: {}, intent: target });
          setPhase("idle");
          return;
        }
        if (quotePdfTusErrorStatus(error) === 409) {
          setPhase("uploaded");
          await finalizeRegistration(target);
          return;
        }
        if (isDeterministicQuotePdfUploadError(error)) {
          const failed = await failQuoteRegistrationAction(target.intentId, "upload_rejected");
          setState(failed);
          if (failed.cleanupAllowed) await removeFailedQuotePdfObject(target.bucket, target.path);
          setIntent({ ...target, intentStatus: "failed" });
          setPhase("failed");
          return;
        }
        setState({ ok: false, message: "La conexión se interrumpió. Conservamos el registro para reanudar la carga.", fieldErrors: {}, intent: target });
        setPhase("idle");
        return;
      } finally {
        abortRef.current = null;
      }
      setProgress(100);
      setPhase("uploaded");
      await finalizeRegistration(target);
    } catch (error) {
      const message = error instanceof Error && /^La cotización|^El PDF|^El archivo/.test(error.message) ? error.message : "No se pudo preparar el PDF para la carga.";
      setState({ ok: false, message, fieldErrors: { pdf: [message] }, intent: intent ?? undefined });
      setPhase(intent ? "idle" : "failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form aria-describedby="quote-create-status quote-create-help quote-create-progress" className="space-y-6" onSubmit={submitRegistration}>
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <ActionMessage id="quote-create-status" state={state} />
      <div className="rounded-xl border border-[color:var(--admin-border)] bg-[color:var(--admin-surface-muted)] p-4">
        <ol className="grid gap-2 text-sm font-medium sm:grid-cols-3" aria-label="Flujo de creación">
          <li className="rounded-lg bg-white px-3 py-2">1. Contacto</li>
          <li className={contactId ? "rounded-lg bg-white px-3 py-2" : "rounded-lg px-3 py-2 text-[color:var(--admin-muted-foreground)]"}>2. Oportunidad</li>
          <li className={opportunityId ? "rounded-lg bg-white px-3 py-2" : "rounded-lg px-3 py-2 text-[color:var(--admin-muted-foreground)]"}>3. Cotización</li>
        </ol>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2" htmlFor="quote-contact-search">
          <span className="text-sm font-medium">Buscar contacto</span>
          <input className={adminInputClassName} id="quote-contact-search" onChange={changeContactSearch} placeholder="Nombre, correo o teléfono" type="search" value={contactSearch} />
        </label>
        <label className="space-y-2" htmlFor="quote-contact-id">
          <span className="text-sm font-medium">Contacto</span>
          <select aria-describedby={["quote-contact-help", firstError(state, "contactId") ? "quote-contact-error" : ""].filter(Boolean).join(" ")} className={adminSelectClassName} disabled={pending || Boolean(intent)} id="quote-contact-id" name="contactId" onChange={changeContact} required value={contactId}>
            <option value="">Selecciona un contacto</option>
            {visibleContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name} · {contact.email ?? contact.phone ?? "sin dato de contacto"}</option>)}
          </select>
          <p className={adminFieldHintClassName} id="quote-contact-help">Primero selecciona la identidad canónica del cliente.</p>
          <FieldError id="quote-contact-error" message={firstError(state, "contactId")} />
        </label>
        <label className="space-y-2 sm:col-span-2" htmlFor="quote-opportunity-id">
          <span className="text-sm font-medium">Oportunidad</span>
          <select aria-describedby={["quote-opportunity-help", firstError(state, "opportunityId") ? "quote-opportunity-error" : ""].filter(Boolean).join(" ")} className={adminSelectClassName} disabled={!contactId || pending || Boolean(intent)} id="quote-opportunity-id" name="opportunityId" onChange={changeOpportunity} required value={opportunityId}>
            <option value="">Selecciona una oportunidad del contacto</option>
            {visibleOpportunities.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunity.label} · {opportunity.status}</option>)}
          </select>
          <p className={adminFieldHintClassName} id="quote-opportunity-help">El servidor vuelve a derivar el contacto desde esta oportunidad antes de crear.</p>
          <FieldError id="quote-opportunity-error" message={firstError(state, "opportunityId")} />
        </label>
        <label className="space-y-2 sm:col-span-2" htmlFor="quote-request-id">
          <span className="text-sm font-medium">Solicitud de origen (opcional)</span>
          <select className={adminSelectClassName} disabled={!opportunityId || pending || Boolean(intent)} id="quote-request-id" name="originatingRequestId" onChange={changeRequest} value={requestId}>
            <option value="">Sin solicitud vinculada</option>
            {visibleRequests.map((request) => <option key={request.id} value={request.id}>{request.createdAt.slice(0, 10)} · {request.status} · {request.destination ?? request.service ?? request.locale}</option>)}
          </select>
        </label>
      </div>
      <CommercialFields disabled={!opportunityId || pending || Boolean(intent)} idPrefix="quote-create" state={state} />
      <label className="space-y-2" htmlFor="quote-create-pdf">
        <span className="text-sm font-medium">PDF inicial</span>
        <input
          accept="application/pdf,.pdf"
          aria-describedby={["quote-create-pdf-help", firstError(state, "pdf") ? "quote-create-pdf-error" : ""].filter(Boolean).join(" ")}
          className={`${adminInputClassName} h-auto py-2.5 file:mr-3 file:rounded-md file:border-0 file:bg-[color:var(--admin-surface-muted)] file:px-3 file:py-2 file:text-sm file:font-medium`}
          disabled={pending || Boolean(intent)}
          id="quote-create-pdf"
          name="pdf"
          onChange={changePdf}
          ref={fileInputRef}
          required
          type="file"
        />
        <p className={adminFieldHintClassName} id="quote-create-pdf-help">PDF obligatorio, máximo 20 MB. Se valida localmente y se sube directo a Storage; el servidor vuelve a descargarlo y verifica bytes, MIME y SHA-256.</p>
        <FieldError id="quote-create-pdf-error" message={firstError(state, "pdf")} />
      </label>
      <p className={adminFieldHintClassName} id="quote-create-help">
        La cotización solo se crea cuando el PDF inicial queda finalizado como V1 lista.{optionsArePartial ? " Hay más opciones disponibles mediante la búsqueda paginada." : ""}
      </p>
      {phase === "uploading" || progress > 0 ? <div className="space-y-2" id="quote-create-progress" role="status"><div className="flex justify-between text-sm"><span>Progreso de carga</span><span>{progress}%</span></div><progress aria-label="Progreso de carga del PDF inicial" className="h-2 w-full" max={100} value={progress}>{progress}%</progress></div> : null}
      <div className="flex flex-wrap gap-3">
        <button className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[color:var(--admin-accent)] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={pending || !opportunityId || !file} type="submit">
          {phase === "validating" ? "Validando PDF..." : phase === "beginning" ? "Reservando registro..." : phase === "uploading" ? "Subiendo PDF..." : phase === "finalizing" ? "Finalizando cotización..." : phase === "uploaded" ? "Reintentar finalización" : "Crear cotización con PDF"}
        </button>
        {phase === "uploading" ? <button className="min-h-11 rounded-lg border border-[color:var(--admin-border)] bg-white px-4 text-sm font-semibold" onClick={() => abortRef.current?.abort()} type="button">Cancelar carga</button> : null}
        {phase === "failed" && intent?.intentStatus === "failed" ? <button className="min-h-11 rounded-lg border border-[color:var(--admin-border)] bg-white px-4 text-sm font-semibold" onClick={resetFailedRegistration} type="button">Elegir otro PDF</button> : null}
      </div>
    </form>
  );
}

type QuoteVersionFormProps = {
  quoteId: string;
  lockVersion: number;
  currentVersion: QuoteVersionSummaryDto | null;
  acceptedVersion: QuoteVersionSummaryDto | null;
  versions: QuoteVersionSummaryDto[];
  requests: QuoteRequestOption[];
};

export function QuoteVersionForm(props: Readonly<QuoteVersionFormProps>) {
  return <QuoteVersionFormScope {...props} key={`${props.lockVersion}:${props.currentVersion?.id ?? "none"}`} />;
}

function QuoteVersionFormScope({ quoteId, lockVersion, currentVersion, acceptedVersion, versions, requests }: Readonly<QuoteVersionFormProps>) {
  const [state, formAction, pending] = useActionState(addQuoteVersionAction, initialQuoteActionState);
  const [idempotencyKey] = useState(() => createQuoteIdempotencyKey("quote_version"));
  const [mode, setMode] = useState<"explicit" | "clone">("explicit");

  function changeMode(event: React.ChangeEvent<HTMLInputElement>) {
    setMode(event.target.value === "clone" ? "clone" : "explicit");
  }

  return (
    <form action={formAction} aria-describedby="quote-version-status quote-version-guidance" className="space-y-6">
      <input name="quoteId" type="hidden" value={quoteId} />
      <input name="expectedLockVersion" type="hidden" value={lockVersion} />
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <ActionMessage id="quote-version-status" state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[color:var(--admin-border)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--admin-muted-foreground)]">Versión actual</p>
          <p className="mt-1 font-medium">{currentVersion ? `V${currentVersion.number} · ${currentVersion.title}` : "Sin versión actual"}</p>
          <p className="text-sm text-[color:var(--admin-muted-foreground)]">{currentVersion?.status ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-[color:var(--admin-border)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--admin-muted-foreground)]">Versión aceptada</p>
          <p className="mt-1 font-medium">{acceptedVersion ? `V${acceptedVersion.number} · ${acceptedVersion.title}` : "Ninguna"}</p>
          <p className="text-sm text-[color:var(--admin-muted-foreground)]">Se conserva independientemente de la versión actual.</p>
        </div>
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Origen de la nueva versión</legend>
        <label className="flex items-start gap-3 rounded-lg border border-[color:var(--admin-border)] p-3">
          <input checked={mode === "explicit"} name="versionMode" onChange={changeMode} type="radio" value="explicit" />
          <span><span className="block text-sm font-medium">Nuevo contenido</span><span className={adminFieldHintClassName}>Captura una propuesta comercial nueva.</span></span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-[color:var(--admin-border)] p-3">
          <input checked={mode === "clone"} name="versionMode" onChange={changeMode} type="radio" value="clone" />
          <span><span className="block text-sm font-medium">Clonar una versión</span><span className={adminFieldHintClassName}>Crea un borrador nuevo; nunca edita contenido enviado o terminal.</span></span>
        </label>
      </fieldset>
      {mode === "clone" ? (
        <label className="space-y-2" htmlFor="quote-clone-version">
          <span className="text-sm font-medium">Versión fuente</span>
          <select className={adminSelectClassName} id="quote-clone-version" name="cloneVersionId" required>
            <option value="">Selecciona una versión</option>
            {versions.map((version) => <option key={version.id} value={version.id}>V{version.number} · {version.title} · {version.status}</option>)}
          </select>
        </label>
      ) : (
        <CommercialFields disabled={pending} idPrefix="quote-version" state={state} />
      )}
      {mode === "explicit" ? (
        <label className="space-y-2" htmlFor="quote-version-request">
          <span className="text-sm font-medium">Solicitud relacionada (opcional)</span>
          <select className={adminSelectClassName} id="quote-version-request" name="quoteRequestId">
            <option value="">Sin solicitud adicional</option>
            {requests.map((request) => <option key={request.id} value={request.id}>{request.createdAt.slice(0, 10)} · {request.status}</option>)}
          </select>
        </label>
      ) : null}
      <p className={adminFieldHintClassName} id="quote-version-guidance">La versión se guarda como borrador y no necesita PDF hasta avanzar en el ciclo.</p>
      <button className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[color:var(--admin-accent)] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Creando versión..." : "Crear nueva versión"}
      </button>
    </form>
  );
}
