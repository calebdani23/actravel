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
  const metadata = highlights.slice(0, 3);
  const hasRevealContent = highlights.length > 0 || Boolean(note);

  const card = (
    <article className="relative flex h-full min-h-[33rem] flex-col overflow-hidden rounded-[2rem] bg-[#101826] p-3 text-white shadow-[0_28px_80px_-36px_rgba(15,23,42,0.9)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-2 group-hover:shadow-[0_38px_90px_-36px_rgba(15,23,42,0.95)] group-focus-visible:-translate-y-2 group-focus-visible:shadow-[0_38px_90px_-36px_rgba(15,23,42,0.95)]">
      <div className="absolute inset-3 overflow-hidden rounded-[1.6rem] bg-[linear-gradient(145deg,rgba(27,139,173,0.22),rgba(238,89,42,0.24)),url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 640 920%22%3E%3Cdefs%3E%3ClinearGradient id=%22g%22 x1=%220%22 x2=%221%22 y1=%220%22 y2=%221%22%3E%3Cstop stop-color=%22%231b8bad%22 stop-opacity=%22.38%22/%3E%3Cstop offset=%221%22 stop-color=%22%23ee592a%22 stop-opacity=%22.2%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%22640%22 height=%22920%22 fill=%22%230f172a%22/%3E%3Ccircle cx=%22532%22 cy=%22172%22 r=%2290%22 fill=%22url(%23g)%22/%3E%3Cpath d=%22M0 704c100-72 211-96 334-48s207 44 306-18v282H0z%22 fill=%22%23ffffff%22 fill-opacity=%22.1%22/%3E%3C/svg%3E')] bg-cover bg-center transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:bottom-[12.75rem] group-focus-visible:bottom-[12.75rem] md:bottom-[7.5rem]">
        {imageUrl ? <img alt="" className="absolute inset-0 h-full w-full object-cover transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.08] group-hover:-translate-y-3 group-focus-visible:scale-[1.08] group-focus-visible:-translate-y-3" loading="lazy" src={imageUrl} /> : null}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04)_0%,rgba(15,23,42,0.18)_32%,rgba(15,23,42,0.68)_72%,rgba(15,23,42,0.94)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-white/8 backdrop-blur-[18px] [mask-image:linear-gradient(to_top,black_20%,transparent_100%)]" />
        <div className="absolute inset-x-6 bottom-6 h-16 rounded-full bg-black/35 blur-2xl" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-5">
          {eyebrow ? <span className="rounded-full border border-white/18 bg-white/88 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--ac-blue)] shadow-sm backdrop-blur-md">{eyebrow}</span> : null}
          {price ? <span className="rounded-full border border-white/18 bg-white/88 px-3 py-1.5 text-xs font-black text-[var(--ac-red)] shadow-sm backdrop-blur-md">{price}</span> : null}
        </div>
      </div>
      <div className="relative z-10 mt-auto px-2 pb-2">
        <div className="overflow-hidden rounded-[1.6rem] border border-white/12 bg-white/12 p-5 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.95)] backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:bg-white/14 group-hover:-translate-y-1 group-focus-visible:bg-white/14 group-focus-visible:-translate-y-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="max-w-[16rem] text-[1.85rem] font-black leading-tight text-white [text-wrap:balance]">{title}</h3>
              <p className="mt-3 max-w-[22rem] text-sm leading-6 text-white/78">{summary}</p>
            </div>
            {href ? (
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/14 bg-white/12 text-white/90 shadow-sm transition duration-300 group-hover:translate-x-1 group-hover:bg-white group-hover:text-[var(--ac-ink)] group-focus-visible:translate-x-1 group-focus-visible:bg-white group-focus-visible:text-[var(--ac-ink)]">
                <ChevronRight className="size-4" />
              </div>
            ) : null}
          </div>

          {metadata.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {metadata.map((item) => (
                <span key={item} className="rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">
                  {item}
                </span>
              ))}
            </div>
          ) : null}

          {hasRevealContent ? (
            <div className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:max-h-0 md:translate-y-4 md:opacity-0 md:group-hover:mt-4 md:group-hover:max-h-52 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-visible:mt-4 md:group-focus-visible:max-h-52 md:group-focus-visible:translate-y-0 md:group-focus-visible:opacity-100">
              <div className="grid gap-3 border-t border-white/12 pt-4 text-sm leading-6 text-white/74">
                {highlights.length ? (
                  <ul className="grid gap-2">
                    {highlights.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                ) : null}
                {note ? <p className="text-xs leading-5 text-white/60">{note}</p> : null}
              </div>
            </div>
          ) : null}

          {href ? (
            <div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4">
              <span className="text-sm font-semibold tracking-[0.08em] text-white/88 uppercase">{cta}</span>
              <span className="h-px flex-1 bg-white/14" />
              <span className="flex size-10 items-center justify-center rounded-full border border-white/14 bg-white/12 text-white transition duration-300 group-hover:translate-x-1 group-hover:bg-[var(--ac-red)] group-focus-visible:translate-x-1 group-focus-visible:bg-[var(--ac-red)]">
                <ChevronRight className="size-4" />
              </span>
            </div>
          ) : null}
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
