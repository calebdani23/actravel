import type { MetadataRoute } from "next";
import { getPublicSeoSitemapEntries } from "@/lib/seo/public-seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getPublicSeoSitemapEntries();
}
