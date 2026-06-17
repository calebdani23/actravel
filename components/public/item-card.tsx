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
    <article className="relative flex h-full min-h-[31rem] flex-col overflow-hidden rounded-[2rem] border border-white/75 bg-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.55)] transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_34px_80px_-34px_rgba(15,23,42,0.65)] group-focus-visible:-translate-y-1.5 group-focus-visible:shadow-[0_34px_80px_-34px_rgba(15,23,42,0.65)]">
      <div className="relative h-80 overflow-hidden bg-[linear-gradient(135deg,rgba(27,139,173,0.18),rgba(238,89,42,0.16)),url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 640 420%22%3E%3Cpath d=%22M0 310c95-48 181-56 289-17s201 40 351-28v155H0z%22 fill=%22%23fff%22 fill-opacity=%22.72%22/%3E%3Ccircle cx=%22528%22 cy=%2296%22 r=%2258%22 fill=%22%23ee592a%22 fill-opacity=%22.32%22/%3E%3C/svg%3E')] bg-cover bg-center">
        {imageUrl ? <img alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.05] group-focus-visible:scale-[1.05]" loading="lazy" src={imageUrl} /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--ac-ink)] via-[var(--ac-ink)]/25 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-5">
          {eyebrow ? <span className="rounded-full bg-white/92 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--ac-blue)] shadow-sm backdrop-blur-sm">{eyebrow}</span> : null}
          {price ? <span className="rounded-full bg-white/92 px-3 py-1.5 text-xs font-black text-[var(--ac-red)] shadow-sm backdrop-blur-sm">{price}</span> : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 pb-8">
          <div className="inline-flex max-w-full rounded-[1.5rem] bg-[var(--ac-ink)]/45 px-4 py-3 backdrop-blur-[2px]">
            <h3 className="max-w-[18rem] text-2xl font-black text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.45)]">{title}</h3>
          </div>
        </div>
      </div>
      <div className="relative -mt-16 px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="flex h-full flex-col rounded-[1.75rem] bg-white/96 p-5 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.55)] backdrop-blur-md transition duration-300 group-hover:-translate-y-2 group-focus-visible:-translate-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="text-sm leading-6 text-muted-foreground">{summary}</p>
            </div>
            {href ? (
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--ac-light-bg)] text-[var(--ac-blue)] shadow-sm transition duration-300 group-hover:bg-[var(--ac-blue)] group-hover:text-white group-focus-visible:bg-[var(--ac-blue)] group-focus-visible:text-white">
                <ChevronRight className="size-4" />
              </div>
            ) : null}
          </div>

          {metadata.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {metadata.map((item) => (
                <span key={item} className="rounded-full border border-[var(--ac-blue)]/12 bg-[var(--ac-light-bg)] px-3 py-1 text-xs font-semibold text-[var(--ac-ink)]">
                  {item}
                </span>
              ))}
            </div>
          ) : null}

          {hasRevealContent ? (
            <div className="mt-4 overflow-hidden transition-all duration-300 md:mt-0 md:max-h-0 md:translate-y-3 md:opacity-0 md:group-hover:mt-4 md:group-hover:max-h-48 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-visible:mt-4 md:group-focus-visible:max-h-48 md:group-focus-visible:translate-y-0 md:group-focus-visible:opacity-100">
              <div className="grid gap-3 border-t border-black/5 pt-4">
                {highlights.length ? (
                  <ul className="grid gap-2 text-sm leading-6 text-zinc-700">
                    {highlights.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                ) : null}
                {note ? <p className="text-xs leading-5 text-muted-foreground">{note}</p> : null}
              </div>
            </div>
          ) : null}

          {href ? (
            <div className="mt-auto pt-4">
              <div className="flex items-center justify-between gap-3 rounded-[1.25rem] bg-[var(--ac-light-bg)]/90 px-4 py-3 text-sm font-bold text-[var(--ac-ink)] ring-1 ring-[var(--ac-blue)]/10">
                <span>{cta}</span>
                <span className="flex size-9 items-center justify-center rounded-full bg-white text-[var(--ac-blue)] shadow-sm transition duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1">
                  <ChevronRight className="size-4" />
                </span>
              </div>
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
