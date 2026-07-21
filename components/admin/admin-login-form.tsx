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
  const [focusTarget, setFocusTarget] = useState<"email" | "password" | "toggle" | "submit" | null>(null);

  const fieldFocusStyle = {
    borderColor: "#1b8bad",
    boxShadow: "0 0 0 3px rgba(27,139,173,0.22), 0 1px 2px rgba(33,24,22,0.04)",
  } as const;
  const toggleFocusStyle = {
    borderColor: "rgba(27,139,173,0.45)",
    backgroundColor: "#edf8fb",
    boxShadow: "0 0 0 3px rgba(27,139,173,0.24)",
  } as const;
  const submitFocusStyle = {
    boxShadow: "0 0 0 3px rgba(27,139,173,0.24), 0 14px 30px rgba(168,13,22,0.24)",
  } as const;

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
    <form onSubmit={handleSubmit}>
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
            onFocus={() => setFocusTarget("email")}
            onBlur={() => setFocusTarget((current) => (current === "email" ? null : current))}
            disabled={!configured || isSubmitting}
            required
            aria-invalid={hasMessage || undefined}
            aria-describedby="admin-login-status"
            style={focusTarget === "email" ? fieldFocusStyle : undefined}
            className={cn(
                "h-12 w-full rounded-2xl border bg-white pl-11 pr-4 text-sm text-[#211816] shadow-[0_1px_2px_rgba(33,24,22,0.04)] outline-none transition disabled:cursor-not-allowed disabled:bg-[#f6f2ef] disabled:text-[#9b8f89] autofill:bg-transparent",
                hasMessage ? "border-[#eb0816]/40" : "border-[#eadfd9] hover:border-[#1b8bad]/40",
              )}
            />
        </div>
      </div>
      <div className="mt-5 space-y-2.5">
        <label className="text-sm font-medium text-[#211816]" htmlFor="admin-password">
          Contraseña
        </label>
        <div id="admin-password-field" className="relative rounded-2xl focus-within:[box-shadow:0_0_0_3px_rgba(27,139,173,0.18)]">
          <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1b8bad]" aria-hidden="true" />
          <input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onFocus={() => setFocusTarget("password")}
            onBlur={() => setFocusTarget((current) => (current === "password" ? null : current))}
            disabled={!configured || isSubmitting}
            required
            aria-invalid={hasMessage || undefined}
            aria-describedby="admin-login-status"
            style={focusTarget === "password" ? fieldFocusStyle : undefined}
            className={cn(
                "h-12 w-full rounded-2xl border bg-white pl-11 pr-14 text-sm text-[#211816] shadow-[0_1px_2px_rgba(33,24,22,0.04)] outline-none transition disabled:cursor-not-allowed disabled:bg-[#f6f2ef] disabled:text-[#9b8f89] autofill:bg-transparent",
                hasMessage ? "border-[#eb0816]/40" : "border-[#eadfd9] hover:border-[#1b8bad]/40",
              )}
            />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            onFocusCapture={() => setFocusTarget("toggle")}
            onBlurCapture={() => setFocusTarget((current) => (current === "toggle" ? null : current))}
            disabled={!configured || isSubmitting}
            style={focusTarget === "toggle" ? toggleFocusStyle : undefined}
            className={cn(
              "absolute right-1.5 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-transparent bg-white/80 text-[#6d5f5a] outline-none transition hover:border-[#eadfd9] hover:bg-[#f8eef7] hover:text-[#211816] active:scale-[0.98] focus:border-[#1b8bad]/45 focus:bg-[#edf8fb] focus:[box-shadow:0_0_0_3px_rgba(27,139,173,0.24)] disabled:cursor-not-allowed disabled:opacity-50",
            )}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div id="admin-login-status" aria-live="polite" className="mt-3 min-h-[1.1rem]">
        {message ? (
          <div className="flex h-full items-start gap-3 rounded-2xl border border-[#eb0816]/15 bg-[#fff3f3] px-4 py-2.5 text-sm text-[#8b2730]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{message}</p>
          </div>
        ) : null}
      </div>

      <Button
        className={cn(
          "mt-3 h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#c94722_0%,#a80d16_100%)] text-sm font-semibold text-white shadow-[0_14px_30px_rgba(168,13,22,0.24)] hover:opacity-100 hover:shadow-[0_18px_38px_rgba(168,13,22,0.3)] focus:[box-shadow:0_0_0_3px_rgba(27,139,173,0.24),0_14px_30px_rgba(168,13,22,0.24)] disabled:shadow-none",
        )}
        type="submit"
        onFocusCapture={() => setFocusTarget("submit")}
        onBlurCapture={() => setFocusTarget((current) => (current === "submit" ? null : current))}
        disabled={!configured || isSubmitting}
        style={focusTarget === "submit" ? submitFocusStyle : undefined}
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

      <p className="mt-5 text-center text-xs leading-5 text-[#7a6e69]">
        Acceso exclusivo para personal autorizado.
      </p>
    </form>
  );
}
