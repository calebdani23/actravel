import Link from "next/link";
import { SectionHeader } from "@/components/public/section-header";
import { localizedPath, type FAQItem } from "@/lib/content/public-site";
import { type Locale } from "@/lib/i18n/config";

export function FAQSection({ locale, title, description, items }: Readonly<{ locale: Locale; title: string; description: string; items: FAQItem[] }>) {
  return (
    <section className="space-y-6 rounded-[2rem] border bg-white p-6 shadow-sm md:p-8">
      <SectionHeader title={title} description={description} />
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <article key={item.question} className="rounded-3xl bg-[var(--ac-light-bg)] p-5">
            <h3 className="font-black text-[var(--ac-ink)]">{item.question}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
          </article>
        ))}
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        {locale === "es" ? "Para condiciones provisionales revisa " : "For provisional conditions, see "}
        <Link className="font-bold text-[var(--ac-blue)] underline-offset-4 hover:underline" href={localizedPath(locale, "payments")}>{locale === "es" ? "pagos y cancelaciones" : "payments and cancellations"}</Link>
        {locale === "es" ? " o envíanos tus datos para una cotización." : " or send us your details for a quote."}
      </p>
    </section>
  );
}
