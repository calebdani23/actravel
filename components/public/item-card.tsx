import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
  return (
    <Card className="flex h-full flex-col border-white/80 bg-white/85 shadow-sm">
      <CardHeader>
        <div className="mb-3 h-28 overflow-hidden rounded-3xl bg-[linear-gradient(135deg,rgba(27,139,173,0.18),rgba(238,89,42,0.16)),url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 320 160%22%3E%3Cpath d=%22M0 125c48-24 89-25 146-5s102 18 174-15v55H0z%22 fill=%22%23fff%22 fill-opacity=%22.7%22/%3E%3Ccircle cx=%22254%22 cy=%2244%22 r=%2226%22 fill=%22%23ee592a%22 fill-opacity=%22.35%22/%3E%3C/svg%3E')] bg-cover bg-center">
          {imageUrl ? <img alt="" className="h-full w-full object-cover" loading="lazy" src={imageUrl} /> : null}
        </div>
        {eyebrow ? <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--ac-blue)]">{eyebrow}</p> : null}
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="text-sm leading-6 text-muted-foreground">{summary}</p>
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
          <Button asChild variant="outline" className="rounded-full">
            <Link href={href}>{cta}</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
