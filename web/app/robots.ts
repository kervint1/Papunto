import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * ログイン後の画面と管理画面はクロールさせない。
 * 個人のポイント残高や運営データが検索結果に出ることは絶対に避ける。
 * （各ページ側にも noindex を入れてある。robots.txt はクロール、noindex はインデックスの制御で
 *  役割が違うため、両方必要）
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/home", "/cuenta", "/wallet", "/exchange", "/admin", "/api/"],
    },
    // robots.txtはドメインルートにしか置けないため、メディア側のsitemapもここに登録する
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/blog/sitemap.xml`],
  };
}
