import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function ItemCard({
  title,
  summary,
  eyebrow,
  price,
  href,
  cta,
  highlights = [],
  note,
  imageUrl,
}: Readonly<{ title: string; summary: string; eyebrow?: string; price?: string; href?: string; cta: string; highlights?: string[]; note?: string; imageUrl?: string }>) {
  const hasSupportingContent = highlights.length > 0 || Boolean(note);

  const card = (
    <article data-supporting-content={hasSupportingContent ? "available" : undefined} className="relative flex h-full min-h-[30rem] flex-col overflow-hidden rounded-[2rem] border border-[var(--ac-blue)]/12 bg-white text-[var(--ac-ink)] shadow-[0_24px_60px_-36px_rgba(33,24,22,0.28)] transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_32px_72px_-36px_rgba(33,24,22,0.34)] group-focus-visible:-translate-y-1.5 group-focus-visible:shadow-[0_32px_72px_-36px_rgba(33,24,22,0.34)]">
      <div className="relative aspect-[4/5] overflow-hidden bg-[linear-gradient(145deg,var(--ac-blue-soft)_0%,#ffffff_52%,#fff1e8_100%)]">
        {imageUrl ? <img alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04] group-focus-visible:scale-[1.04]" loading="lazy" src={imageUrl} /> : null}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.02)_30%,rgba(15,23,42,0.38)_100%)]" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-5">
          {eyebrow ? <span className="rounded-full border border-[var(--ac-blue)]/12 bg-white/92 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--ac-blue)] shadow-sm">{eyebrow}</span> : null}
          {price ? <span className="rounded-full border border-[#c94a1f]/18 bg-white/92 px-3 py-1.5 text-xs font-black text-[#c94a1f] shadow-sm">{price}</span> : null}
        </div>
        {href ? (
          <div className="absolute right-5 top-16 flex size-11 items-center justify-center rounded-full border border-white/70 bg-white/88 text-[#c94a1f] shadow-sm backdrop-blur-sm transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-focus-visible:translate-x-0.5 group-focus-visible:-translate-y-0.5">
            <ChevronRight className="size-4" />
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,transparent_0%,rgba(15,23,42,0.14)_100%)]" />
      </div>
      <div className="relative flex flex-1 flex-col bg-[linear-gradient(180deg,#ffffff_0%,#f7fcff_100%)] px-6 pb-7 pt-6">
        <span className="mb-4 h-1.5 w-16 rounded-full bg-[#c94a1f]" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="max-w-[18rem] text-[1.75rem] font-black leading-tight text-[var(--ac-ink)] [text-wrap:balance]">{title}</h3>
          <p className="mt-3 max-w-[24rem] text-sm leading-6 text-slate-600">{summary}</p>
        </div>
      </div>
    </article>
  );

  if (!href) return <div className="group h-full">{card}</div>;

  return (
    <Link href={href} aria-label={`${cta}: ${title}`} className="group block h-full rounded-[2rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ac-blue)] focus-visible:ring-offset-4">
      {card}
    </Link>
  );
}
