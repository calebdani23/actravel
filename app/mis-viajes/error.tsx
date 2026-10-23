"use client";
export default function CustomerPortalError({ reset }: { error: Error; reset: () => void }) {
  return <main className="mx-auto max-w-lg space-y-4 px-6 py-16">
    <h1 className="text-2xl font-semibold">Customer access is unavailable</h1>
    <p role="alert">Please try again or contact AC Travel.</p>
    <button onClick={reset} className="rounded border px-4 py-2">Try again</button>
  </main>;
}
