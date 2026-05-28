import type { Locale } from "@/lib/i18n/config";
import type { PublicCatalogContent } from "@/lib/content/public-site";

export function buildPublicCatalogStaticParams(
  content: Pick<PublicCatalogContent, "destinations" | "promotions">,
  locale: Locale,
  kind: "destinations" | "promotions",
) {
  return content[kind].map((item) => ({ locale, slug: item.slug[locale] }));
}
