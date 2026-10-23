"use client";

import { useEffect, useRef } from "react";

export default function DashboardError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  const alertRef = useRef<HTMLElement>(null);

  useEffect(() => {
    alertRef.current?.focus();
  }, []);

  return (
    <section ref={alertRef} role="alert" tabIndex={-1} aria-live="assertive" className="m-6 space-y-3 rounded-[var(--admin-radius-panel)] border border-[color:var(--admin-border-subtle)] bg-white p-5 focus-visible:outline focus-visible:outline-2">
      <h2 className="text-lg font-semibold">No pudimos mostrar el Dashboard.</h2>
      <p>Intenta cargar la página de nuevo.</p>
      <button className="rounded border px-3 py-2 font-medium focus-visible:outline focus-visible:outline-2" onClick={reset} type="button">Reintentar</button>
    </section>
  );
}
