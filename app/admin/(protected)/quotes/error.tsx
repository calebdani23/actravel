"use client";

import { useEffect } from "react";

export default function QuotesError({ error, unstable_retry }: Readonly<{ error: Error & { digest?: string }; unstable_retry: () => void }>) {
  useEffect(() => {
    console.error("[admin-quotes] route boundary", { digest: error.digest ?? null });
  }, [error.digest]);
  return <main className="mx-auto max-w-3xl px-4 py-12"><div className="rounded-xl border border-red-200 bg-red-50 p-6" role="alert"><h1 className="text-xl font-semibold text-red-950">No se pudo cargar Cotizaciones</h1><p className="mt-2 text-sm text-red-900">La vista encontró un problema temporal. No se aplicó ninguna mutación desde este mensaje.</p><button className="mt-5 rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white" onClick={unstable_retry} type="button">Intentar nuevamente</button></div></main>;
}
