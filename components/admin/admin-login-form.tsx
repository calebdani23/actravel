"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseSetupMessage, isSupabaseBrowserConfigured } from "@/lib/supabase/config";

export function AdminLoginForm() {
  const configured = isSupabaseBrowserConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(configured ? "" : getSupabaseSetupMessage());
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!configured) {
      setMessage(getSupabaseSetupMessage());
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    const { error } = await createClient().auth.signInWithPassword({ email, password });

    if (error) {
      setMessage("No pudimos iniciar sesión. Verifica tus credenciales o solicita acceso interno.");
      setIsSubmitting(false);
      return;
    }

    window.location.href = "/admin/dashboard";
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-950" htmlFor="admin-email">
          Email
        </label>
        <input
          id="admin-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={!configured || isSubmitting}
          required
          className="w-full rounded-md border px-3 py-2 text-sm disabled:bg-zinc-100"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-950" htmlFor="admin-password">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={!configured || isSubmitting}
          required
          className="w-full rounded-md border px-3 py-2 text-sm disabled:bg-zinc-100"
        />
      </div>
      {message ? <p className="rounded-md bg-zinc-100 p-3 text-sm text-zinc-700">{message}</p> : null}
      <Button className="w-full" type="submit" disabled={!configured || isSubmitting}>
        {isSubmitting ? "Validando..." : "Entrar con Supabase"}
      </Button>
      <p className="text-xs text-muted-foreground">
        El acceso final depende de roles internos activos; RLS sigue protegiendo los datos.
      </p>
    </form>
  );
}
