"use client";

import { FormEvent, useState } from "react";
import { AlertCircle, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseBrowserConfigured } from "@/lib/supabase/config";

const unavailableMessage = "En este momento no es posible acceder al panel. Inténtalo nuevamente más tarde o contacta al responsable interno.";
const invalidCredentialsMessage = "No fue posible iniciar sesión. Verifica tus datos e inténtalo nuevamente.";

export function AdminLoginForm() {
  const configured = isSupabaseBrowserConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(configured ? "" : unavailableMessage);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const hasMessage = Boolean(message);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    if (!configured) {
      setMessage(unavailableMessage);
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    const { error } = await createClient().auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(invalidCredentialsMessage);
      setIsSubmitting(false);
      return;
    }

    window.location.href = "/admin/dashboard";
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2.5">
        <label className="text-sm font-medium text-[#211816]" htmlFor="admin-email">
          Correo electrónico
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1b8bad]" aria-hidden="true" />
          <input
            id="admin-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={!configured || isSubmitting}
            required
            aria-invalid={hasMessage || undefined}
            aria-describedby="admin-login-status"
            className={cn(
              "h-12 w-full rounded-2xl border bg-white pl-11 pr-4 text-sm text-[#211816] shadow-[0_1px_2px_rgba(33,24,22,0.04)] outline-none transition focus:border-[#1b8bad] focus:ring-4 focus:ring-[#1b8bad]/20 disabled:cursor-not-allowed disabled:bg-[#f6f2ef] disabled:text-[#9b8f89] autofill:bg-transparent",
              hasMessage ? "border-[#eb0816]/40" : "border-[#eadfd9] hover:border-[#1b8bad]/40",
            )}
          />
        </div>
      </div>
      <div className="space-y-2.5">
        <label className="text-sm font-medium text-[#211816]" htmlFor="admin-password">
          Contraseña
        </label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1b8bad]" aria-hidden="true" />
          <input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={!configured || isSubmitting}
            required
            aria-invalid={hasMessage || undefined}
            aria-describedby="admin-login-status"
            className={cn(
              "h-12 w-full rounded-2xl border bg-white pl-11 pr-14 text-sm text-[#211816] shadow-[0_1px_2px_rgba(33,24,22,0.04)] outline-none transition focus:border-[#1b8bad] focus:ring-4 focus:ring-[#1b8bad]/20 disabled:cursor-not-allowed disabled:bg-[#f6f2ef] disabled:text-[#9b8f89] autofill:bg-transparent",
              hasMessage ? "border-[#eb0816]/40" : "border-[#eadfd9] hover:border-[#1b8bad]/40",
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            disabled={!configured || isSubmitting}
            className="absolute right-1.5 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-[#6d5f5a] outline-none transition hover:bg-[#f8eef7] hover:text-[#211816] focus-visible:ring-2 focus-visible:ring-[#1b8bad] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div id="admin-login-status" aria-live="polite" className="min-h-5">
        {message ? (
          <div className="flex h-full items-start gap-3 rounded-2xl border border-[#eb0816]/15 bg-[#fff3f3] px-4 py-3 text-sm text-[#8b2730]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{message}</p>
          </div>
        ) : null}
      </div>

      <Button
        className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#c94722_0%,#a80d16_100%)] text-sm font-semibold text-white shadow-[0_14px_30px_rgba(168,13,22,0.24)] hover:opacity-100 hover:shadow-[0_18px_38px_rgba(168,13,22,0.3)] focus-visible:ring-[#1b8bad] disabled:shadow-none"
        type="submit"
        disabled={!configured || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Iniciando sesión…
          </>
        ) : (
          "Iniciar sesión"
        )}
      </Button>

      <p className="text-center text-xs leading-5 text-[#7a6e69]">
        Acceso exclusivo para personal autorizado.
      </p>
    </form>
  );
}
