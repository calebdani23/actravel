import { SectionHeader } from "@/components/public/section-header";

export function TrustBlock({ title, description, items }: Readonly<{ title: string; description: string; items: string[] }>) {
  return (
    <section className="rounded-[2rem] bg-[var(--ac-ink)] p-6 text-white md:p-8">
      <SectionHeader title={title} description={description} />
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <div key={item} className="rounded-3xl border border-white/10 bg-white/10 p-5 text-sm font-semibold text-white/85">{item}</div>
        ))}
      </div>
    </section>
  );
}
