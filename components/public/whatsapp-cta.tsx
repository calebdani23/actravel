import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildTrackedWhatsAppUrl } from "@/lib/whatsapp/link";
import { cn } from "@/lib/utils/cn";

type WhatsAppCtaProps = Readonly<{
  message: string;
  label: string;
  shortLabel?: string;
  className?: string;
  floating?: boolean;
  locale?: string;
  pagePath?: string;
}>;

export function WhatsAppCta({ message, label, shortLabel = label, className, floating = false, locale, pagePath }: WhatsAppCtaProps) {
  const href = buildTrackedWhatsAppUrl({ message, locale, pagePath });

  if (floating) {
    return (
      <a
        href={href}
        className={cn(
          "fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-[#25d366] px-4 py-3 text-sm font-extrabold text-white shadow-xl shadow-emerald-900/20 hover:-translate-y-0.5 hover:bg-[#1fbd59] focus:outline-none focus:ring-4 focus:ring-emerald-200 sm:bottom-6 sm:right-6",
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
    <Button asChild className={className}>
      <a href={href}>
        <MessageCircle className="size-4" aria-hidden="true" />
        {label}
      </a>
    </Button>
  );
}
