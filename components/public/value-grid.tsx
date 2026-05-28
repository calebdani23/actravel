import { SectionHeader } from "@/components/public/section-header";

export type ValueGridItem = Readonly<{ title: string; text: string; eyebrow?: string }>;

export function ValueGrid({
  title,
  description,
  items,
  columns = "three",
}: Readonly<{ title?: string; description?: string; items: ValueGridItem[]; columns?: "three" | "four" }>) {
  return (
    <section className="space-y-6">
      {title ? <SectionHeader title={title} description={description} /> : null}
      <div className={columns === "four" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-4" : "grid gap-4 md:grid-cols-3"}>
        {items.map((item) => (
          <article key={item.title} className="rounded-3xl border bg-white p-6 shadow-sm">
            {item.eyebrow ? <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--ac-blue)]">{item.eyebrow}</p> : null}
            <h3 className="mt-2 text-xl font-black text-[var(--ac-ink)]">{item.title}</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
