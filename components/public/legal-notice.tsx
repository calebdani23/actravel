export function LegalNotice({ notice }: Readonly<{ notice: string }>) {
  return <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">{notice}</div>;
}
