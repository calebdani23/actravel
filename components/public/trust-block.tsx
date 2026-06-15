import { SectionHeader } from "@/components/public/section-header";

export function TrustBlock({
  title,
  description,
  items,
  eyebrow,
  itemEyebrow,
}: Readonly<{ title: string; description: string; items: string[]; eyebrow: string; itemEyebrow: string }>) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-[var(--ac-blue)]/10 bg-[linear-gradient(135deg,#f7fcff_0%,#ffffff_42%,#fff6f0_100%)] p-6 text-[var(--ac-ink)] shadow-sm md:p-8">
      <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_top,rgba(27,139,173,0.14),transparent_58%)]" aria-hidden="true" />
      <div className="absolute left-[-4rem] top-[-4rem] size-40 rounded-full bg-[var(--ac-orange)]/10 blur-3xl" aria-hidden="true" />

      <div className="relative">
        <div className="max-w-3xl">
          <p className="text-sm font-extrabold uppercase tracking-[0.3em] text-[var(--ac-blue)]">{eyebrow}</p>
          <div className="mt-3 [&_h2]:text-[var(--ac-ink)] [&_h2]:text-3xl [&_h2]:font-black [&_p]:text-zinc-700 [&_p]:leading-7">
            <SectionHeader title={title} description={description} />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {items.map((item, index) => (
            <div key={item} className="rounded-[1.75rem] border border-[var(--ac-blue)]/10 bg-white/90 p-5 shadow-sm shadow-slate-200/60 backdrop-blur">
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--ac-blue)]/10 text-sm font-black text-[var(--ac-blue)]">
                  0{index + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ac-blue)]/80">{itemEyebrow}</p>
                  <p className="mt-2 text-base font-semibold leading-7 text-[var(--ac-ink)]">{item}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
