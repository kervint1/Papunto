import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/** 未ログインで見られるページだけを載せる（ログイン後の画面はrobots.tsで除外済み） */
const PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/ingresar", priority: 0.5, changeFrequency: "yearly" },
  { path: "/campana", priority: 0.5, changeFrequency: "monthly" },
  { path: "/reclamaciones", priority: 0.4, changeFrequency: "yearly" },
  { path: "/terminos", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacidad", priority: 0.3, changeFrequency: "yearly" },
  { path: "/cookies", priority: 0.2, changeFrequency: "yearly" },
  { path: "/consentimiento-cookies", priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
