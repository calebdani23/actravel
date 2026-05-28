import type { MetadataRoute } from "next";
import { getPublicSeoSitemapEntries } from "@/lib/seo/public-seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return getPublicSeoSitemapEntries();
}
