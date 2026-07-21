"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  CircleUserRound,
  DatabaseZap,
  FileText,
  LayoutDashboard,
  Map,
  Menu,
  MessagesSquare,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
  UserCog,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { AdminNavIcon, AdminNavItem } from "@/components/admin/admin-nav";

const iconMap: Record<AdminNavIcon, typeof LayoutDashboard> = {
  "layout-dashboard": LayoutDashboard,
  "users-round": UsersRound,
  wallet: Wallet,
  "briefcase-business": BriefcaseBusiness,
  "file-text": FileText,
  map: Map,
  package: Package,
  "messages-square": MessagesSquare,
  "shield-alert": ShieldAlert,
  "database-zap": DatabaseZap,
  "user-cog": UserCog,
  "circle-user-round": CircleUserRound,
};

type AdminShellClientProps = {
  children: ReactNode;
  email: string;
  profileName: string;
  roleLabels: string[];
  visibleLinks: AdminNavItem[];
  signOutAction: () => Promise<void>;
};

type Crumb = { label: string };

const groupOrder = ["Resumen", "Comercial", "Contenido", "Administración"] as const;

function isLinkActive(pathname: string, link: AdminNavItem) {
  return pathname === link.href || link.matchPrefixes?.some((prefix) => pathname.startsWith(prefix)) || false;
}

function getRouteContext(pathname: string, visibleLinks: AdminNavItem[]) {
  const activeLink = visibleLinks.find((link) => isLinkActive(pathname, link)) ?? visibleLinks[0];
  const group = activeLink?.group;

  const trail = (extra?: string): Crumb[] => [
    ...(group ? [{ label: group }] : []),
    ...(activeLink ? [{ label: activeLink.label }] : []),
    ...(extra ? [{ label: extra }] : []),
  ];

  if (pathname === "/admin/dashboard") return { eyebrow: "Panel administrativo", title: "Resumen general", breadcrumbs: trail() };
  if (pathname === "/admin/logs") return { eyebrow: "Seguimiento operativo", title: "Registro operativo", breadcrumbs: trail() };
  if (pathname === "/admin/leads") return { eyebrow: "Gestión comercial", title: "Prospectos", breadcrumbs: trail() };
  if (pathname === "/admin/leads/new") return { eyebrow: "Gestión comercial", title: "Nuevo prospecto", breadcrumbs: trail("Nuevo prospecto") };
  if (/^\/admin\/leads\/[^/]+$/.test(pathname)) return { eyebrow: "Gestión comercial", title: "Detalle del prospecto", breadcrumbs: trail("Detalle") };
  if (pathname === "/admin/payments") return { eyebrow: "Gestión comercial", title: "Pagos", breadcrumbs: trail() };
  if (pathname === "/admin/operations/bookings") return { eyebrow: "Gestión comercial", title: "Reservas", breadcrumbs: trail() };
  if (pathname === "/admin/operations/documents") return { eyebrow: "Gestión comercial", title: "Documentos", breadcrumbs: trail() };
  if (pathname.startsWith("/admin/catalog/")) return { eyebrow: "Contenido operativo", title: activeLink?.label ?? "Catálogo", breadcrumbs: trail("Catálogo") };
  if (pathname === "/admin/templates") return { eyebrow: "Contenido operativo", title: "Plantillas", breadcrumbs: trail() };
  if (pathname === "/admin/data-quality") return { eyebrow: "Administración interna", title: "Calidad de datos", breadcrumbs: trail() };
  if (pathname === "/admin/staff") return { eyebrow: "Administración interna", title: "Usuarios", breadcrumbs: trail() };
  if (pathname === "/admin/account") return { eyebrow: "Administración interna", title: "Mi cuenta", breadcrumbs: trail() };

  return { eyebrow: "Panel administrativo", title: activeLink?.label ?? "Panel", breadcrumbs: trail() };
}

function AdminSidebar({
  collapsed,
  visibleLinks,
  pathname,
  email,
  profileName,
  roleLabels,
  signOutAction,
  onClose,
}: Readonly<{
  collapsed: boolean;
  visibleLinks: AdminNavItem[];
  pathname: string;
  email: string;
  profileName: string;
  roleLabels: string[];
  signOutAction: () => Promise<void>;
  onClose?: () => void;
}>) {
  const groupedLinks = groupOrder
    .map((group) => ({ group, items: visibleLinks.filter((link) => link.group === group) }))
    .filter((entry) => entry.items.length > 0);

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-4">
      <div className={cn("flex items-center gap-3 px-2", collapsed && "justify-center px-0")}>
        <Link href="/admin/dashboard" className="flex min-w-0 items-center gap-3 rounded-[var(--admin-radius-control)] px-2 py-2 text-[color:var(--admin-foreground)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--admin-ring)]" onClick={onClose}>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f36f45_0%,#ee592a_48%,#d63f1f_100%)] shadow-[0_16px_32px_rgba(238,89,42,0.28)]">
            <Image src="/brand/ac-travel-logo-bco-500x500.png" alt="AC Travel" width={34} height={34} className="h-8 w-8 object-contain" />
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">AC Travel</span>
              <span className="block truncate text-xs text-[color:var(--admin-muted-foreground)]">Panel administrativo</span>
            </span>
          ) : null}
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-5" aria-label="Navegación administrativa principal">
        {groupedLinks.map(({ group, items }) => (
          <div className="space-y-2" key={group}>
            <div className={cn("px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-muted-foreground)]", collapsed && "sr-only")}>
              {group}
            </div>
            <div className="space-y-1">
              {items.map((link) => {
                const active = isLinkActive(pathname, link);
                const Icon = iconMap[link.icon];
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    title={collapsed ? link.label : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={onClose}
                    className={cn(
                      "group flex items-center gap-3 rounded-[var(--admin-radius-control)] border px-3 py-2.5 text-sm font-medium transition-[background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--admin-ring)]",
                      collapsed ? "justify-center px-2" : "justify-start",
                      active
                        ? "border-[color:var(--admin-brand-border-strong)] bg-[color:var(--admin-brand-bg-strong)] text-[color:var(--admin-brand-fg)] shadow-[0_10px_24px_rgba(238,89,42,0.16)]"
                        : "border-transparent text-[color:var(--admin-sidebar-link)] hover:border-[color:var(--admin-border)] hover:bg-white hover:text-[color:var(--admin-foreground)]",
                    )}
                  >
                    <Icon className={cn("h-[1.125rem] w-[1.125rem] shrink-0", active ? "text-[color:var(--admin-brand-fg)]" : "text-[color:var(--admin-accent)] group-hover:text-[color:var(--admin-brand)]")} aria-hidden="true" />
                    {!collapsed ? <span className="truncate">{link.label}</span> : <span className="sr-only">{link.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-3 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border)] bg-white/90 p-3 shadow-[var(--admin-shadow-card)]">
        <div className={cn("flex items-start gap-3", collapsed && "justify-center") }>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--admin-brand-bg)] text-[color:var(--admin-brand-fg)]">
            <CircleUserRound className="h-5 w-5" aria-hidden="true" />
          </span>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[color:var(--admin-foreground)]">{profileName || email}</p>
              <p className="truncate text-xs text-[color:var(--admin-muted-foreground)]">{email}</p>
              <p className="mt-1 text-xs text-[color:var(--admin-muted-foreground)]">{roleLabels.join(" · ")}</p>
            </div>
          ) : null}
        </div>
        <div className={cn("flex gap-2", collapsed && "flex-col")}>
          {visibleLinks.some((link) => link.href === "/admin/account") ? (
            <Button asChild className={cn("flex-1", collapsed && "w-full px-0")} size="sm" variant="outline">
              <Link href="/admin/account" onClick={onClose}>
                <CircleUserRound className="h-4 w-4" aria-hidden="true" />
                {!collapsed ? "Cuenta" : <span className="sr-only">Cuenta</span>}
              </Link>
            </Button>
          ) : null}
          <form action={signOutAction} className={cn("flex", collapsed && "w-full")}>
            <Button className={cn("w-full", collapsed && "px-0")} size="sm" type="submit" variant="outline">
               {!collapsed ? "Salir" : <span className="sr-only">Salir</span>}
               {collapsed ? <LogOut className="h-4 w-4" aria-hidden="true" /> : null}
             </Button>
           </form>
         </div>
       </div>
    </div>
  );
}

export function AdminShellClient({ children, email, profileName, roleLabels, visibleLinks, signOutAction }: Readonly<AdminShellClientProps>) {
  const pathname = usePathname() ?? "/admin/dashboard";
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileDialogRef = useRef<HTMLElement | null>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    const originalOverflow = document.body.style.overflow;
    lastFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : mobileMenuButtonRef.current;

    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => {
      mobileCloseButtonRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = originalOverflow;
      if (lastFocusedElementRef.current?.isConnected) {
        lastFocusedElementRef.current.focus();
      }
    };
  }, [mobileOpen]);

  const handleMobileDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setMobileOpen(false);
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = mobileDialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    if (!focusable?.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const context = useMemo(() => getRouteContext(pathname, visibleLinks), [pathname, visibleLinks]);
  const sidebarWidthClass = desktopCollapsed ? "lg:w-[5.5rem]" : "lg:w-[18rem]";

  return (
    <div className="min-h-screen overflow-x-clip bg-[color:var(--admin-bg)] text-[color:var(--admin-foreground)]">
      <div className="flex min-h-screen">
        <aside className={cn("hidden border-r border-[color:var(--admin-border)] bg-[color:var(--admin-sidebar)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col", sidebarWidthClass)}>
          <div className="flex items-center justify-end px-4 pt-4">
            <button
              type="button"
              onClick={() => setDesktopCollapsed((value) => !value)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-[color:var(--admin-muted-foreground)] transition hover:border-[color:var(--admin-border)] hover:bg-white hover:text-[color:var(--admin-foreground)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--admin-ring)]"
              aria-label={desktopCollapsed ? "Expandir navegación" : "Contraer navegación"}
              aria-pressed={desktopCollapsed}
            >
              {desktopCollapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          <AdminSidebar collapsed={desktopCollapsed} email={email} pathname={pathname} profileName={profileName} roleLabels={roleLabels} signOutAction={signOutAction} visibleLinks={visibleLinks} />
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 flex lg:hidden" onKeyDown={handleMobileDialogKeyDown}>
            <button type="button" className="absolute inset-0 bg-[#211816]/45 backdrop-blur-[1px]" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />
            <aside ref={mobileDialogRef} className="relative z-10 flex h-full w-[min(21rem,88vw)] flex-col border-r border-[color:var(--admin-border)] bg-[color:var(--admin-sidebar)] shadow-[0_18px_42px_rgba(33,24,22,0.18)]" role="dialog" aria-modal="true" aria-labelledby="admin-mobile-nav-title">
              <h2 id="admin-mobile-nav-title" className="sr-only">Navegación administrativa</h2>
              <div className="flex items-center justify-end px-4 pt-4">
                <button
                  ref={mobileCloseButtonRef}
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-[color:var(--admin-muted-foreground)] transition hover:border-[color:var(--admin-border)] hover:bg-white hover:text-[color:var(--admin-foreground)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--admin-ring)]"
                  aria-label="Cerrar menú"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <AdminSidebar collapsed={false} email={email} onClose={() => setMobileOpen(false)} pathname={pathname} profileName={profileName} roleLabels={roleLabels} signOutAction={signOutAction} visibleLinks={visibleLinks} />
            </aside>
          </div>
        ) : null}

         <div className="flex min-w-0 flex-1 flex-col">
           <header className="sticky top-0 z-30 border-b border-[color:var(--admin-border)] bg-[rgba(255,250,246,0.92)] backdrop-blur-sm">
            <div className="flex min-h-[4.5rem] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <button
                ref={mobileMenuButtonRef}
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--admin-border)] bg-white text-[color:var(--admin-foreground)] shadow-[var(--admin-shadow-control)] lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir menú"
                aria-expanded={mobileOpen}
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-accent)]">{context.eyebrow}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-lg font-semibold text-[color:var(--admin-foreground)] sm:text-xl">{context.title}</p>
                  <div className="hidden flex-wrap items-center gap-2 text-xs text-[color:var(--admin-muted-foreground)] sm:flex">
                    {context.breadcrumbs.map((crumb, index) => (
                      <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-2">
                        {index > 0 ? <span aria-hidden="true">/</span> : null}
                        <span>{crumb.label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="hidden min-w-0 text-right md:block">
                <p className="truncate text-sm font-medium text-[color:var(--admin-foreground)]">{profileName || email}</p>
                <p className="truncate text-xs text-[color:var(--admin-muted-foreground)]">{roleLabels.join(" · ")}</p>
              </div>
            </div>
          </header>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
