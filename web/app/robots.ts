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
      disallow: [
        "/tareas",
        "/cuenta",
        "/canjear",
        "/admin",
        "/api/",
        // 旧URL（リダイレクトで受けている）。転送先も同様に除外済み
        "/home",
        "/exchange",
        "/wallet",
      ],
    },
    // robots.txtはドメインルートにしか置けないため、メディア側のsitemapもここに登録する
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/blog/sitemap.xml`],
  };
}
