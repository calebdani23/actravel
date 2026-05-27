"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import type React from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { getPublicSiteContent } from "@/lib/content/public-site";
import { type Locale } from "@/lib/i18n/config";
import { createQuoteRequestSchema, type QuoteRequestInput, type QuoteRequestResponse } from "@/lib/validations/quote-request";

type Props = Readonly<{ locale: Locale }>;

function defaultValues(locale: Locale): QuoteRequestInput {
  return {
    locale,
    preferredCurrency: locale === "es" ? "MXN" : "USD",
    holderName: "",
    email: undefined,
    whatsapp: "",
    origin: "",
    mainDestination: "",
    departureDate: "",
    returnDate: "",
    adults: 2,
    children: 0,
    serviceInterest: "",
    approximateBudget: 0,
    sourceChannel: "Sitio web",
    contactConsent: false,
    notes: undefined,
  };
}

export function QuoteForm({ locale }: Props) {
  const { t } = getPublicSiteContent(locale);
  const copy = t.quoteForm;
  const schema = useMemo(() => createQuoteRequestSchema(locale), [locale]);
  const [result, setResult] = useState<QuoteRequestResponse | null>(null);

  const form = useForm<QuoteRequestInput>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(locale),
    mode: "onBlur",
  });
  const preferredCurrency = useWatch({ control: form.control, name: "preferredCurrency" });

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
          <p className="text-sm leading-6 text-zinc-700">{locale === "es" ? "Puedes acelerar la conversación continuando con el mensaje preparado." : "You can speed up the conversation by continuing with the prepared message."}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="rounded-full">
              <a href={result.whatsapp.href} target="_blank" rel="noreferrer">{copy.whatsappCta}</a>
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => { form.reset(defaultValues(locale)); setResult(null); }}>
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
      </div>

      <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label={copy.fields.holderName} placeholder={copy.placeholders.holderName} error={form.formState.errors.holderName?.message} {...form.register("holderName")} />
          <TextField label={copy.fields.whatsapp} placeholder={copy.placeholders.whatsapp} error={form.formState.errors.whatsapp?.message} {...form.register("whatsapp")} />
          <TextField label={copy.fields.email} type="email" placeholder={copy.placeholders.email} error={form.formState.errors.email?.message} {...form.register("email")} />
          <TextField label={copy.fields.origin} placeholder={copy.placeholders.origin} error={form.formState.errors.origin?.message} {...form.register("origin")} />
          <TextField label={copy.fields.mainDestination} placeholder={copy.placeholders.mainDestination} error={form.formState.errors.mainDestination?.message} {...form.register("mainDestination")} />
          <SelectField label={copy.fields.serviceInterest} error={form.formState.errors.serviceInterest?.message} {...form.register("serviceInterest")}>
            <option value="">{locale === "es" ? "Selecciona" : "Select"}</option>
            {copy.serviceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
          <TextField label={copy.fields.departureDate} type="date" error={form.formState.errors.departureDate?.message} {...form.register("departureDate")} />
          <TextField label={copy.fields.returnDate} type="date" error={form.formState.errors.returnDate?.message} {...form.register("returnDate")} />
          <TextField label={copy.fields.adults} type="number" min={1} error={form.formState.errors.adults?.message} {...form.register("adults", { valueAsNumber: true })} />
          <TextField label={copy.fields.children} type="number" min={0} error={form.formState.errors.children?.message} {...form.register("children", { valueAsNumber: true })} />
          <TextField label={`${copy.fields.approximateBudget} (${preferredCurrency})`} type="number" min={0} placeholder={copy.placeholders.budget} error={form.formState.errors.approximateBudget?.message} {...form.register("approximateBudget", { valueAsNumber: true })} />
          <SelectField label={copy.fields.preferredCurrency} error={form.formState.errors.preferredCurrency?.message} {...form.register("preferredCurrency")}>
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </SelectField>
          <SelectField label={copy.fields.sourceChannel} error={form.formState.errors.sourceChannel?.message} {...form.register("sourceChannel")}>
            {copy.sourceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        </div>
        <label className="grid gap-2 text-sm font-bold text-[var(--ac-ink)]">
          {copy.fields.notes}
          <textarea className="min-h-28 rounded-2xl border px-4 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-[var(--ac-blue)]" placeholder={copy.placeholders.notes} {...form.register("notes")} />
        </label>
        <label className="flex gap-3 rounded-2xl bg-[var(--ac-light-bg)] p-4 text-sm leading-6 text-zinc-700">
          <input className="mt-1 h-4 w-4" type="checkbox" {...form.register("contactConsent")} />
          <span>{copy.fields.contactConsent}</span>
        </label>
        {form.formState.errors.contactConsent?.message ? <p className="text-sm font-semibold text-[var(--ac-red)]">{form.formState.errors.contactConsent.message}</p> : null}
        {result && !result.ok ? <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-[var(--ac-red)]">{copy.failureTitle}: {result.message}</p> : null}
        <Button type="submit" className="rounded-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? copy.submitting : copy.submit}
        </Button>
      </form>
    </section>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

function TextField({ label, error, ...props }: FieldProps) {
  return (
    <label className="grid gap-2 text-sm font-bold text-[var(--ac-ink)]">
      {label}
      <input className="rounded-2xl border px-4 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-[var(--ac-blue)]" {...props} />
      {error ? <span className="text-xs font-semibold text-[var(--ac-red)]">{error}</span> : null}
    </label>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string };

function SelectField({ label, error, children, ...props }: SelectProps) {
  return (
    <label className="grid gap-2 text-sm font-bold text-[var(--ac-ink)]">
      {label}
      <select className="rounded-2xl border px-4 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-[var(--ac-blue)]" {...props}>{children}</select>
      {error ? <span className="text-xs font-semibold text-[var(--ac-red)]">{error}</span> : null}
    </label>
  );
}
