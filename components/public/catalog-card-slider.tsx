"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FormattedPrice } from "@/components/public/formatted-price";
import { ItemCard } from "@/components/public/item-card";
import { Button } from "@/components/ui/button";
import { type Currency } from "@/lib/currency/config";
import { localizedPath, type PublicItem } from "@/lib/content/public-site";
import { type Locale } from "@/lib/i18n/config";

type SliderSection = "services" | "packages" | "deals" | "destinations";

export function CatalogCardSlider({
  locale,
  items,
  section,
  cta,
  initialCurrency,
  previousLabel,
  nextLabel,
}: Readonly<{
  locale: Locale;
  items: PublicItem[];
  section: SliderSection;
  cta: string;
  initialCurrency: Currency;
  previousLabel?: string;
  nextLabel?: string;
}>) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(items.length > 1);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const updateButtons = () => {
      const maxScrollLeft = Math.max(track.scrollWidth - track.clientWidth, 0);
      setCanScrollPrev(track.scrollLeft > 8);
      setCanScrollNext(track.scrollLeft < maxScrollLeft - 8);
    };

    updateButtons();
    track.addEventListener("scroll", updateButtons, { passive: true });
    window.addEventListener("resize", updateButtons);
    return () => {
      track.removeEventListener("scroll", updateButtons);
      window.removeEventListener("resize", updateButtons);
    };
  }, [items.length]);

  const scrollByCard = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const firstCard = track.querySelector<HTMLElement>("[data-slider-card]");
    const step = firstCard ? firstCard.offsetWidth + 20 : track.clientWidth * 0.9;
    track.scrollBy({ left: step * direction, behavior: "smooth" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => scrollByCard(-1)} disabled={!canScrollPrev} aria-label={previousLabel ?? (locale === "es" ? "Ver elementos anteriores" : "View previous items")}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => scrollByCard(1)} disabled={!canScrollNext} aria-label={nextLabel ?? (locale === "es" ? "Ver más elementos" : "View more items")}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div ref={trackRef} className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <div key={item.id} data-slider-card className="min-w-0 shrink-0 basis-[85%] snap-start sm:basis-[calc(50%-0.625rem)] xl:basis-[calc((100%-2.5rem)/3)]">
            <ItemCard
              title={item.title[locale]}
              summary={item.summary[locale]}
              eyebrow={item.eyebrow?.[locale]}
              price={<FormattedPrice locale={locale} price={item.price} initialCurrency={initialCurrency} />}
              highlights={item.highlights[locale]}
              note={item.detailNote?.[locale] ?? undefined}
              href={localizedPath(locale, section, item.slug[locale])}
              cta={cta}
              imageUrl={item.media?.thumbnailImageUrl ?? item.media?.heroImageUrl ?? undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
