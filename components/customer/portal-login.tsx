"use client";

import { useActionState, useMemo, useState, useSyncExternalStore } from "react";
import { requestCodeAction, verifyCodeAction } from "@/app/mis-viajes/acceso/actions";

function createInvitationStore() {
  // Per-form lifetime, never module-global or persistent browser storage.
  let token = "";
  return {
    getSnapshot: () => token,
    getServerSnapshot: () => "",
    subscribe: (notify: () => void) => {
      const capture = () => {
        const incoming = new URLSearchParams(window.location.hash.slice(1)).get("invite");
        if (!incoming) return;
        token = incoming;
        window.history.replaceState(null, "", window.location.pathname);
        notify();
      };
      window.addEventListener("hashchange", capture);
      capture();
      return () => window.removeEventListener("hashchange", capture);
    },
  };
}

export function PortalLogin() {
  const store = useMemo(() => createInvitationStore(), []);
  const invitationToken = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [email, setEmail] = useState("");
  const [sent, request, requesting] = useActionState(requestCodeAction, "");
  const [error, verify, verifying] = useActionState(verifyCodeAction, "");
  return <div className="space-y-6">
    <p>Use the email address on your AC Travel invitation. No password is required.</p>
    <form action={request} className="space-y-3">
      <input type="hidden" name="invitationToken" value={invitationToken} />
      <label className="block">Email
        <input className="block w-full rounded border p-2" type="email" name="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} />
      </label>
      <button disabled={requesting || verifying} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{requesting ? "Sending…" : "Send access code"}</button>
      {sent && <p role="status">{sent}</p>}
    </form>
    <form action={verify} className="space-y-3">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="invitationToken" value={invitationToken} />
      <label className="block">Verification code
        <input className="block w-full rounded border p-2" name="code" required pattern="[0-9]{6}" maxLength={6} inputMode="numeric" autoComplete="one-time-code" />
      </label>
      <button disabled={requesting || verifying || !email} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{verifying ? "Verifying…" : "Enter customer portal"}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  </div>;
}
