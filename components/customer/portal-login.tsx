"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { requestCodeAction, verifyCodeAction } from "@/app/mis-viajes/acceso/actions";

export function PortalLogin() {
  const requestToken = useRef<HTMLInputElement>(null);
  const verificationToken = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [sent, request, requesting] = useActionState(requestCodeAction, "");
  const [error, verify, verifying] = useActionState(verifyCodeAction, "");
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("invite");
    if (token) {
      if (requestToken.current) requestToken.current.defaultValue = token;
      if (verificationToken.current) verificationToken.current.defaultValue = token;
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  return <div className="space-y-6">
    <p>Use the email address on your AC Travel invitation. No password is required.</p>
    <form action={request} className="space-y-3">
      <input type="hidden" name="invitationToken" defaultValue="" ref={requestToken} />
      <label className="block">Email
        <input className="block w-full rounded border p-2" type="email" name="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} />
      </label>
      <button disabled={requesting || verifying} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{requesting ? "Sending…" : "Send access code"}</button>
      {sent && <p role="status">{sent}</p>}
    </form>
    <form action={verify} className="space-y-3">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="invitationToken" defaultValue="" ref={verificationToken} />
      <label className="block">Verification code
        <input className="block w-full rounded border p-2" name="code" required pattern="[0-9]{6}" maxLength={6} inputMode="numeric" autoComplete="one-time-code" />
      </label>
      <button disabled={requesting || verifying || !email} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{verifying ? "Verifying…" : "Enter customer portal"}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  </div>;
}
