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
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-3 py-4 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="grid w-full overflow-hidden rounded-[1.9rem] border border-white/75 bg-white/72 shadow-[0_24px_70px_rgba(33,24,22,0.11)] backdrop-blur-sm lg:grid-cols-[1.15fr_0.95fr]">
          <section className="relative isolate overflow-hidden bg-[#ee592a] text-white">
            <div className="relative flex min-h-[14.5rem] flex-col justify-between px-5 py-5 sm:min-h-[17rem] sm:px-7 sm:py-7 lg:min-h-[42rem] lg:px-10 lg:py-10">
              <div className="absolute inset-0">
                <Image
                  src="/brand/ac-travel-admin-login-visual.svg"
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  className="object-cover object-[center_28%] sm:object-[center_24%] lg:object-center"
                />
                <div className="absolute inset-0 bg-[linear-gradient(130deg,rgba(204,63,26,0.2)_0%,rgba(204,63,26,0.08)_26%,rgba(211,44,31,0.16)_56%,rgba(32,19,17,0.58)_100%)]" />
                <div className="absolute inset-y-0 left-0 w-40 bg-[linear-gradient(90deg,rgba(150,47,20,0.42),rgba(150,47,20,0.18),transparent)]" />
                <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,transparent,rgba(33,24,22,0.22))] lg:h-40" />
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

              <div className="relative z-10 mt-8 max-w-[20rem] sm:max-w-[24rem] lg:mt-auto lg:max-w-xl">
                <p className="text-sm font-semibold tracking-[0.22em] text-white/80 uppercase">AC Travel Mx</p>
                <h1 className="mt-3 max-w-md text-[1.8rem] font-semibold leading-tight text-balance sm:text-4xl lg:text-[2.75rem]">
                  Panel administrativo
                </h1>
                <p className="mt-4 max-w-lg text-sm leading-6 text-white/88 sm:text-base">
                  Gestiona el catálogo, las promociones y las solicitudes de viaje desde un solo lugar.
                </p>
                <p className="mt-5 text-sm font-medium text-[#f8eef7] sm:mt-6 sm:text-base">
                  Suma viajes, suma experiencias, suma sueños.
                </p>
              </div>
            </div>
          </section>

          <section className="flex items-center bg-[radial-gradient(circle_at_top,#faf1f8_0%,#fffefd_44%,#ffffff_100%)] px-4 py-5 sm:px-6 sm:py-7 lg:px-9 lg:py-9">
            <Card className="w-full rounded-[1.7rem] border border-[#f3e7e0] bg-white/95 shadow-[0_14px_38px_rgba(33,24,22,0.06)]">
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
