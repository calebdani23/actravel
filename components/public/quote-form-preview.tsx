import { WhatsAppCta } from "@/components/public/whatsapp-cta";

export function QuoteFormPreview({ title, text, cta, message }: Readonly<{ title: string; text: string; cta: string; message: string }>) {
  const fields = ["Destino", "Fechas", "Personas", "Presupuesto", "Hotel / tour deseado", "Comentarios"];
  return (
    <section className="rounded-[2rem] border bg-white p-6 shadow-sm md:p-8">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-[var(--ac-red)]">Quote scaffold</p>
          <h1 className="mt-2 text-3xl font-black text-[var(--ac-ink)]">{title}</h1>
          <p className="mt-4 leading-7 text-muted-foreground">{text}</p>
          <WhatsAppCta message={message} label={cta} pagePath="quote-preview" className="mt-6 rounded-full" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {fields.map((field) => (
            <div key={field} className="rounded-2xl border bg-[var(--ac-light-bg)] px-4 py-3 text-sm font-semibold text-muted-foreground">{field}</div>
          ))}
          <p className="md:col-span-2 text-xs leading-5 text-muted-foreground">No submission is enabled in Block 3; this preview documents the future intake fields.</p>
        </div>
      </div>
    </section>
  );
}
