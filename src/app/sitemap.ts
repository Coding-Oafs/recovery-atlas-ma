import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/site";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: publicSiteUrl + "/",
      lastModified: "2026-10-26",
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
