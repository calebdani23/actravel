"use client";

import type { HTMLAttributeAnchorTarget } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackMetaPixelEvent } from "@/lib/analytics/meta-pixel";
import { buildTrackedWhatsAppUrl } from "@/lib/whatsapp/link";
import { cn } from "@/lib/utils/cn";

type WhatsAppCtaProps = Readonly<{
  message: string;
  label: string;
  shortLabel?: string;
  className?: string;
  floating?: boolean;
  href?: string;
  locale?: string;
  pagePath?: string;
  rel?: string;
  target?: HTMLAttributeAnchorTarget;
}>;

const whatsappCtaClasses = "bg-[#25d366] text-white shadow-sm shadow-emerald-900/15 hover:bg-[#1fbd59] hover:opacity-100 focus-visible:ring-[#25d366]/35";

export function WhatsAppCta({ message, label, shortLabel = label, className, floating = false, href, locale, pagePath, rel, target }: WhatsAppCtaProps) {
  const whatsappHref = href ?? buildTrackedWhatsAppUrl({ message, locale, pagePath });
  const handleClick = () => {
    trackMetaPixelEvent("Contact");
  };

  if (floating) {
    return (
      <a
        href={whatsappHref}
        onClick={handleClick}
        rel={rel}
        target={target}
        className={cn(
          "fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-extrabold shadow-xl shadow-emerald-900/20 transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 sm:bottom-6 sm:right-6",
          whatsappCtaClasses,
          className,
        )}
      >
        <MessageCircle className="size-5" aria-hidden="true" />
        <span className="sm:hidden">{shortLabel}</span>
        <span className="hidden sm:inline">{label}</span>
      </a>
    );
  }

  return (
    <Button asChild className={cn(whatsappCtaClasses, className)}>
      <a href={whatsappHref} onClick={handleClick} rel={rel} target={target}>
        <MessageCircle className="size-4" aria-hidden="true" />
        {label}
      </a>
    </Button>
  );
}
