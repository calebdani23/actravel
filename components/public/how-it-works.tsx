import { SectionHeader } from "@/components/public/section-header";

export function HowItWorks({ title, description, steps }: Readonly<{ title: string; description: string; steps: string[] }>) {
  return (
    <section className="grid gap-6 rounded-[2rem] border bg-white p-6 shadow-sm md:grid-cols-[0.8fr_1.2fr] md:p-8">
      <SectionHeader title={title} description={description} />
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step} className="rounded-3xl bg-[var(--ac-light-bg)] p-5">
            <div className="mb-4 grid size-10 place-items-center rounded-2xl bg-[var(--ac-orange)] text-sm font-black text-white">0{index + 1}</div>
            <p className="text-sm font-semibold leading-6 text-[var(--ac-ink)]">{step}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
