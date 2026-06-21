"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useForm, useWatch } from "react-hook-form";
import { WhatsAppCta } from "@/components/public/whatsapp-cta";
import { Button } from "@/components/ui/button";
import { getPublicSiteContent } from "@/lib/content/public-site";
import { type Locale } from "@/lib/i18n/config";
import { buildAbandonmentSnapshot, buildDraftSnapshot, mergeRecoveredDraft, QUOTE_FORM_RECOVERY_TTL_MS, quoteFormStorageKey, readStoredRecovery, safeStorageRemoveItem, safeStorageSetItem, type QuoteFormAbandonmentSnapshot, type QuoteFormRecoveryDraft } from "@/lib/quote-form-recovery";
import { createQuoteRequestSchema, type QuoteRequestInput, type QuoteRequestResponse } from "@/lib/validations/quote-request";

export type QuoteFormInitialContext = Partial<Pick<QuoteRequestInput, "mainDestination" | "serviceInterest" | "sourceChannel" | "preferredCurrency" | "campaignContext">>;

type Props = Readonly<{ locale: Locale; initialContext?: QuoteFormInitialContext }>;

type RecoveryNotice = {
  restoredDraft: boolean;
  abandonment?: QuoteFormAbandonmentSnapshot | null;
};

function defaultValues(locale: Locale, initialContext: QuoteFormInitialContext = {}): QuoteRequestInput {
  return {
    locale,
    preferredCurrency: initialContext.preferredCurrency ?? "MXN",
    holderName: "",
    email: "",
    whatsapp: "",
    origin: "",
    mainDestination: initialContext.mainDestination ?? "",
    departureDate: "",
    returnDate: "",
    adults: 2,
    children: 0,
    serviceInterest: initialContext.serviceInterest ?? "",
    approximateBudget: 0,
    sourceChannel: initialContext.sourceChannel ?? (locale === "es" ? "Sitio web" : "Website"),
    contactConsent: false,
    notes: "",
    campaignContext: initialContext.campaignContext ?? undefined,
    website: "",
  };
}

export function QuoteForm({ locale, initialContext }: Props) {
  const { t } = getPublicSiteContent(locale);
  const copy = t.quoteForm;
  const schema = useMemo(() => createQuoteRequestSchema(locale), [locale]);
  const [result, setResult] = useState<QuoteRequestResponse | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<RecoveryNotice | null>(null);
  const formDefaults = useMemo(() => defaultValues(locale, initialContext), [locale, initialContext]);
  const recoveryPriorityFields = useMemo(() => ([
    initialContext?.mainDestination ? "mainDestination" : null,
    initialContext?.serviceInterest ? "serviceInterest" : null,
    initialContext?.sourceChannel ? "sourceChannel" : null,
    initialContext?.preferredCurrency ? "preferredCurrency" : null,
    initialContext?.campaignContext ? "campaignContext" : null,
  ].filter((field): field is "mainDestination" | "serviceInterest" | "sourceChannel" | "preferredCurrency" | "campaignContext" => Boolean(field))), [initialContext]);
  const recoveryLoaded = useRef(false);
  const draftStorageKey = useMemo(() => quoteFormStorageKey(locale, "draft"), [locale]);
  const abandonmentStorageKey = useMemo(() => quoteFormStorageKey(locale, "abandonment"), [locale]);

  const form = useForm<QuoteRequestInput>({
    resolver: zodResolver(schema),
    defaultValues: formDefaults,
    mode: "onBlur",
  });
  const preferredCurrency = useWatch({ control: form.control, name: "preferredCurrency" });
  const watchedValues = useWatch({ control: form.control });
  const serviceOptions = optionList(copy.serviceOptions, formDefaults.serviceInterest);
  const sourceOptions = optionList(copy.sourceOptions, formDefaults.sourceChannel);

  useEffect(() => {
    if (typeof window === "undefined" || recoveryLoaded.current) return;
    recoveryLoaded.current = true;

    let restoredDraft = false;
    let abandonment: QuoteFormAbandonmentSnapshot | null = null;

    const savedDraft = readStoredRecovery<QuoteFormRecoveryDraft>(window.localStorage, draftStorageKey, QUOTE_FORM_RECOVERY_TTL_MS.draft);
    if (savedDraft) {
      form.reset(mergeRecoveredDraft(formDefaults, savedDraft, { preferDefaultFields: recoveryPriorityFields }));
      restoredDraft = true;
    }

    abandonment = readStoredRecovery<QuoteFormAbandonmentSnapshot>(window.localStorage, abandonmentStorageKey, QUOTE_FORM_RECOVERY_TTL_MS.abandonment);

    if (restoredDraft || abandonment) setRecoveryNotice({ restoredDraft, abandonment });
  }, [abandonmentStorageKey, draftStorageKey, form, formDefaults, recoveryPriorityFields]);

  useEffect(() => {
    if (typeof window === "undefined" || !form.formState.isDirty) return;
    safeStorageSetItem(window.localStorage, draftStorageKey, JSON.stringify(buildDraftSnapshot(watchedValues as QuoteRequestInput)));
  }, [draftStorageKey, form.formState.isDirty, watchedValues]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const saveAbandonment = () => {
      if (result?.ok || !form.formState.isDirty) return;
      safeStorageSetItem(window.localStorage, draftStorageKey, JSON.stringify(buildDraftSnapshot(form.getValues())));
      safeStorageSetItem(window.localStorage, abandonmentStorageKey, JSON.stringify(buildAbandonmentSnapshot(form.getValues(), form.formState.errors, form.formState.dirtyFields)));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") saveAbandonment();
    };

    window.addEventListener("pagehide", saveAbandonment);
    window.addEventListener("beforeunload", saveAbandonment);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", saveAbandonment);
      window.removeEventListener("beforeunload", saveAbandonment);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [abandonmentStorageKey, draftStorageKey, form, form.formState.dirtyFields, form.formState.errors, form.formState.isDirty, result?.ok]);

  async function onSubmit(values: QuoteRequestInput) {
    setResult(null);
    const response = await fetch("/api/quote-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = (await response.json()) as QuoteRequestResponse;
    if (!data.ok && data.fieldErrors) {
      for (const [field, messages] of Object.entries(data.fieldErrors)) {
        if (messages?.[0]) form.setError(field as keyof QuoteRequestInput, { message: messages[0] });
      }
    }
    setResult(data);
    if (data.ok && typeof window !== "undefined") {
      safeStorageRemoveItem(window.localStorage, draftStorageKey);
      safeStorageRemoveItem(window.localStorage, abandonmentStorageKey);
      setRecoveryNotice(null);
    }
  }

  if (result?.ok) {
    return (
      <section className="grid gap-6 rounded-[2rem] border bg-white p-6 shadow-sm lg:grid-cols-[0.9fr_1.1fr] lg:p-10">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-[var(--ac-blue)]">{copy.eyebrow}</p>
          <h1 className="mt-3 text-4xl font-black text-[var(--ac-ink)] md:text-5xl">{copy.successTitle}</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">{result.message}</p>
          <p className="mt-4 text-sm font-bold text-[var(--ac-red)]">Ref. {result.leadReference}</p>
        </div>
        <div className="rounded-[2rem] bg-[var(--ac-light-bg)] p-6">
          <p className="text-sm font-semibold leading-6 text-[var(--ac-ink)]">{copy.successNextStep}</p>
          <p className="mt-4 text-sm leading-6 text-zinc-700">{copy.successDisclaimer}</p>
          <p className="mt-4 text-sm leading-6 text-zinc-700">{copy.successWhatsAppHelp}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <WhatsAppCta message="" label={copy.whatsappCta} href={result.whatsapp.href} target="_blank" rel="noreferrer" className="rounded-full" />
            <Button type="button" variant="outline" className="rounded-full" onClick={() => { form.reset(formDefaults); setResult(null); setRecoveryNotice(null); }}>
              {copy.reset}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-8 rounded-[2rem] border bg-white p-6 shadow-sm lg:grid-cols-[0.85fr_1.15fr] lg:p-10">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-[var(--ac-blue)]">{copy.eyebrow}</p>
        <h1 className="mt-3 text-4xl font-black text-[var(--ac-ink)] md:text-5xl">{copy.title}</h1>
        <p className="mt-5 text-lg leading-8 text-muted-foreground">{copy.description}</p>
        <p className="mt-6 rounded-2xl bg-[var(--ac-light-bg)] p-4 text-sm leading-6 text-zinc-700">{t.quoteText}</p>
        {recoveryNotice ? <QuoteRecoveryNotice locale={locale} notice={recoveryNotice} /> : null}
      </div>

      <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <label className="sr-only" aria-hidden="true">
          Website
          <input tabIndex={-1} autoComplete="off" {...form.register("website")} />
        </label>
        <input type="hidden" {...form.register("campaignContext")} />
        <FormSection title={copy.sections.contact.title} description={copy.sections.contact.description}>
          <TextField label={copy.fields.holderName} marker={copy.requiredMarker} hint={copy.hints.holderName} placeholder={copy.placeholders.holderName} error={form.formState.errors.holderName?.message} {...form.register("holderName")} />
          <TextField label={copy.fields.email} marker={copy.requiredMarker} hint={copy.hints.email} type="email" placeholder={copy.placeholders.email} error={form.formState.errors.email?.message} {...form.register("email")} />
          <TextField label={copy.fields.whatsapp} marker={copy.requiredMarker} hint={copy.hints.whatsapp} placeholder={copy.placeholders.whatsapp} error={form.formState.errors.whatsapp?.message} {...form.register("whatsapp")} />
        </FormSection>
        <FormSection title={copy.sections.trip.title} description={copy.sections.trip.description}>
          <TextField label={copy.fields.origin} marker={copy.requiredMarker} hint={copy.hints.origin} placeholder={copy.placeholders.origin} error={form.formState.errors.origin?.message} {...form.register("origin")} />
          <TextField label={copy.fields.mainDestination} marker={copy.requiredMarker} hint={copy.hints.mainDestination} placeholder={copy.placeholders.mainDestination} error={form.formState.errors.mainDestination?.message} {...form.register("mainDestination")} />
          <TextField label={copy.fields.departureDate} marker={copy.requiredMarker} hint={copy.hints.departureDate} type="date" error={form.formState.errors.departureDate?.message} {...form.register("departureDate")} />
          <TextField label={copy.fields.returnDate} marker={copy.requiredMarker} hint={copy.hints.returnDate} type="date" error={form.formState.errors.returnDate?.message} {...form.register("returnDate")} />
          <TextField label={copy.fields.adults} marker={copy.requiredMarker} hint={copy.hints.travelers} type="number" min={1} error={form.formState.errors.adults?.message} {...form.register("adults", { valueAsNumber: true })} />
          <TextField label={copy.fields.children} marker={copy.requiredMarker} hint={copy.hints.travelers} type="number" min={0} error={form.formState.errors.children?.message} {...form.register("children", { valueAsNumber: true })} />
        </FormSection>
        <FormSection title={copy.sections.context.title} description={copy.sections.context.description}>
          <SelectField label={copy.fields.serviceInterest} marker={copy.requiredMarker} hint={copy.hints.serviceInterest} error={form.formState.errors.serviceInterest?.message} {...form.register("serviceInterest")}>
            <option value="">{locale === "es" ? "Selecciona" : "Select"}</option>
            {serviceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
          <TextField label={`${copy.fields.approximateBudget} (${preferredCurrency})`} marker={copy.requiredMarker} hint={copy.hints.approximateBudget} type="number" min={0} placeholder={copy.placeholders.budget} error={form.formState.errors.approximateBudget?.message} {...form.register("approximateBudget", { valueAsNumber: true })} />
          <SelectField label={copy.fields.preferredCurrency} marker={copy.requiredMarker} error={form.formState.errors.preferredCurrency?.message} {...form.register("preferredCurrency")}>
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </SelectField>
          <SelectField label={copy.fields.sourceChannel} marker={copy.requiredMarker} hint={copy.hints.sourceChannel} error={form.formState.errors.sourceChannel?.message} {...form.register("sourceChannel")}>
            {sourceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        </FormSection>
        <label className="grid gap-2 text-sm font-bold text-[var(--ac-ink)]">
          <LabelText label={copy.fields.notes} marker={copy.optionalMarker} />
          <span className="text-xs font-medium leading-5 text-muted-foreground">{copy.hints.notes}</span>
          <textarea className="min-h-28 rounded-2xl border px-4 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-[var(--ac-blue)]" placeholder={copy.placeholders.notes} {...form.register("notes")} />
        </label>
        <label className="flex gap-3 rounded-2xl bg-[var(--ac-light-bg)] p-4 text-sm leading-6 text-zinc-700">
          <input className="mt-1 h-4 w-4" type="checkbox" {...form.register("contactConsent")} />
          <span><span className="font-bold text-[var(--ac-ink)]">{copy.fields.contactConsent}</span><span className="mt-1 block text-xs text-muted-foreground">{copy.hints.contactConsent}</span></span>
        </label>
        {form.formState.errors.contactConsent?.message ? <p className="text-sm font-semibold text-[var(--ac-red)]">{form.formState.errors.contactConsent.message}</p> : null}
        {result && !result.ok ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-[var(--ac-red)]"><p className="font-semibold">{copy.failureTitle}: {result.message}</p><p className="mt-2 leading-6">{copy.failureRecovery}</p></div> : null}
        <Button type="submit" className="rounded-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? copy.submitting : copy.submit}
        </Button>
      </form>
    </section>
  );
}

function QuoteRecoveryNotice({ locale, notice }: Readonly<{ locale: Locale; notice: RecoveryNotice }>) {
  const frictionCount = notice.abandonment?.frictionFields.length ?? 0;
  const dirtyCount = notice.abandonment?.dirtyFields.length ?? 0;

  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
      <p className="font-semibold">{locale === "es" ? "Recuperamos tu avance reciente." : "We recovered your recent progress."}</p>
      <p className="mt-1">
        {locale === "es"
          ? notice.restoredDraft
            ? `Este dispositivo guardó un borrador local para retomarlo. Campos con interacción previa: ${dirtyCount}.`
            : "Detectamos un intento reciente que quedó pendiente en este dispositivo."
          : notice.restoredDraft
            ? `This device saved a local draft so you can continue it. Previously touched fields: ${dirtyCount}.`
            : "We detected a recent unfinished attempt on this device."}
      </p>
      {frictionCount ? <p className="mt-1">{locale === "es" ? `Últimos campos con fricción o validación pendiente: ${frictionCount}.` : `Last fields with friction or pending validation: ${frictionCount}.`}</p> : null}
    </div>
  );
}

function optionList(options: readonly string[], current?: string) {
  return current && !options.includes(current) ? [current, ...options] : options;
}

function FormSection({ title, description, children }: Readonly<{ title: string; description: string; children: React.ReactNode }>) {
  return (
    <fieldset className="grid gap-4 rounded-[1.5rem] border border-zinc-100 p-4">
      <legend className="px-2 text-sm font-black text-[var(--ac-ink)]">{title}</legend>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function LabelText({ label, marker }: Readonly<{ label: string; marker: string }>) {
  return <span className="flex items-center justify-between gap-3"><span>{label}</span><span className="rounded-full bg-[var(--ac-light-bg)] px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-wide text-muted-foreground">{marker}</span></span>;
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; marker: string; hint?: string; error?: string };

function TextField({ label, marker, hint, error, ...props }: FieldProps) {
  return (
    <label className="grid gap-2 text-sm font-bold text-[var(--ac-ink)]">
      <LabelText label={label} marker={marker} />
      {hint ? <span className="text-xs font-medium leading-5 text-muted-foreground">{hint}</span> : null}
      <input className="rounded-2xl border px-4 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-[var(--ac-blue)]" {...props} />
      {error ? <span className="text-xs font-semibold text-[var(--ac-red)]">{error}</span> : null}
    </label>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; marker: string; hint?: string; error?: string };

function SelectField({ label, marker, hint, error, children, ...props }: SelectProps) {
  return (
    <label className="grid gap-2 text-sm font-bold text-[var(--ac-ink)]">
      <LabelText label={label} marker={marker} />
      {hint ? <span className="text-xs font-medium leading-5 text-muted-foreground">{hint}</span> : null}
      <select className="rounded-2xl border px-4 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-[var(--ac-blue)]" {...props}>{children}</select>
      {error ? <span className="text-xs font-semibold text-[var(--ac-red)]">{error}</span> : null}
    </label>
  );
}
