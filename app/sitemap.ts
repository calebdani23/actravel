import type { MetadataRoute } from "next";
import { getPublicSeoSitemapEntries } from "@/lib/seo/public-seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getPublicSeoSitemapEntries();
}
