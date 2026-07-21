import type { Metadata } from "next";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getAdminSession } from "@/lib/admin/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Acceso administrativo",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) redirect("/admin/dashboard");

  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#fffdfb_0%,#fff7f3_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 shadow-[0_30px_80px_rgba(33,24,22,0.12)] backdrop-blur-sm lg:grid-cols-[1.15fr_0.95fr]">
          <section className="relative isolate overflow-hidden bg-[#ee592a] text-white">
            <div className="relative flex min-h-[15rem] flex-col justify-between px-5 py-6 sm:min-h-[18rem] sm:px-7 sm:py-8 lg:min-h-[42rem] lg:px-10 lg:py-10">
              <div className="absolute inset-0">
                <Image
                  src="/brand/ac-travel-hero-banner-es.png"
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  className="object-cover object-center"
                />
                <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(238,89,42,0.76)_0%,rgba(235,8,22,0.54)_34%,rgba(27,139,173,0.22)_68%,rgba(33,24,22,0.82)_100%)]" />
                <div className="absolute left-0 top-0 h-44 w-44 rounded-full bg-[#ee592a]/30 blur-3xl motion-reduce:transform-none" />
                <div className="absolute bottom-0 right-0 h-52 w-52 rounded-full bg-[#eb0816]/28 blur-3xl motion-reduce:transform-none" />
                <div className="absolute inset-y-0 left-0 w-32 bg-[linear-gradient(90deg,rgba(238,89,42,0.24),transparent)]" />
              </div>

              <div className="relative z-10 flex items-start justify-between gap-4">
                <Image
                  src="/brand/ac-travel-logo-bco-500x500.png"
                  alt="AC Travel"
                  width={84}
                  height={84}
                  className="h-14 w-14 rounded-2xl border border-white/20 bg-white/10 p-2 shadow-lg sm:h-16 sm:w-16"
                />
                <div className="hidden rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-medium tracking-[0.18em] text-white/90 uppercase lg:block">
                  Acceso interno
                </div>
              </div>

              <div className="relative z-10 mt-10 max-w-xl lg:mt-auto">
                <p className="text-sm font-semibold tracking-[0.22em] text-white/80 uppercase">AC Travel Mx</p>
                <h1 className="mt-3 max-w-md text-3xl font-semibold leading-tight text-balance sm:text-4xl lg:text-[2.75rem]">
                  Panel administrativo
                </h1>
                <p className="mt-4 max-w-lg text-sm leading-6 text-white/88 sm:text-base">
                  Gestiona el catálogo, las promociones y las solicitudes de viaje desde un solo lugar.
                </p>
                <p className="mt-6 text-sm font-medium text-[#f8eef7] sm:text-base">
                  Suma viajes, suma experiencias, suma sueños.
                </p>
              </div>
            </div>
          </section>

          <section className="flex items-center bg-[radial-gradient(circle_at_top,#f8eef7_0%,#fffefe_45%,#ffffff_100%)] px-4 py-5 sm:px-6 sm:py-7 lg:px-10 lg:py-10">
            <Card className="w-full border-white/80 bg-white/92 shadow-none">
              <CardContent className="p-5 sm:p-7 lg:p-8">
                <div className="mb-6 space-y-4 sm:mb-7">
                  <Image
                    src="/brand/ac-travel-logo-original-500x135.png"
                    alt="AC Travel Mx"
                    width={200}
                    height={54}
                    priority
                    className="h-auto w-[10.5rem] sm:w-[12rem]"
                  />
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold tracking-tight text-[#211816] sm:text-[2rem]">Bienvenido</h2>
                    <p className="max-w-md text-sm leading-6 text-[#6d5f5a] sm:text-[0.95rem]">
                      Inicia sesión para acceder al panel administrativo de AC Travel.
                    </p>
                  </div>
                </div>

                <AdminLoginForm />
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}
