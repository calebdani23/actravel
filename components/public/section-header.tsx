export function SectionHeader({ eyebrow, title, description }: Readonly<{ eyebrow?: string; title: string; description?: string }>) {
  return (
    <div className="max-w-3xl">
      {eyebrow ? <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-[var(--ac-blue)]">{eyebrow}</p> : null}
      <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--ac-ink)] md:text-4xl">{title}</h2>
      {description ? <p className="mt-3 text-base leading-7 text-muted-foreground">{description}</p> : null}
    </div>
  );
}
