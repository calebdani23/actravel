import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const card = (
    <Card className="flex h-full flex-col overflow-hidden border-white/80 bg-white/90 shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:shadow-xl group-focus-visible:-translate-y-1 group-focus-visible:shadow-xl">
      <div className="relative h-52 overflow-hidden bg-[linear-gradient(135deg,rgba(27,139,173,0.18),rgba(238,89,42,0.16)),url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 640 420%22%3E%3Cpath d=%22M0 310c95-48 181-56 289-17s201 40 351-28v155H0z%22 fill=%22%23fff%22 fill-opacity=%22.72%22/%3E%3Ccircle cx=%22528%22 cy=%2296%22 r=%2258%22 fill=%22%23ee592a%22 fill-opacity=%22.32%22/%3E%3C/svg%3E')] bg-cover bg-center">
        {imageUrl ? <img alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] group-focus-visible:scale-[1.03]" loading="lazy" src={imageUrl} /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--ac-ink)]/90 via-[var(--ac-ink)]/35 to-[var(--ac-ink)]/10" />
        <div className="absolute inset-x-0 top-0 flex items-start p-4">
          {eyebrow ? <span className="rounded-full bg-white/92 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--ac-blue)] shadow-sm backdrop-blur-sm">{eyebrow}</span> : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="inline-flex max-w-full rounded-3xl bg-[var(--ac-ink)]/45 px-4 py-3 backdrop-blur-[2px]">
            <CardTitle className="max-w-[18rem] text-2xl font-black text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.45)]">{title}</CardTitle>
          </div>
        </div>
      </div>
      <CardHeader className="pb-3 pt-5">
        <p className="text-sm leading-6 text-muted-foreground">{summary}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 pt-0">
        {highlights.length ? (
          <ul className="grid gap-1 text-sm text-zinc-700">
            {highlights.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        ) : null}
        {price ? <p className="mt-auto font-extrabold text-[var(--ac-red)]">{price}</p> : null}
        {note ? <p className="text-xs leading-5 text-muted-foreground">{note}</p> : null}
        {href ? (
          <div className="mt-auto flex items-center justify-between rounded-2xl bg-[var(--ac-light-bg)] px-4 py-3 text-sm font-bold text-[var(--ac-ink)]">
            <span>{cta}</span>
            <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  if (!href) return card;

  return (
    <Link href={href} aria-label={`${cta}: ${title}`} className="group block h-full rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ac-blue)] focus-visible:ring-offset-4">
      {card}
    </Link>
  );
}
