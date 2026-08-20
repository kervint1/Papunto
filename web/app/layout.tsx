import type { Metadata } from "next";

import { AdminFab } from "@/components/AdminFab";
import { ReferralClaimer } from "@/components/ReferralClaimer";
import { Footer } from "@/components/Footer";
import { LANG, LOCALE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  // canonical・OGP・sitemapの絶対URLの基点。未設定だと相対URLのまま出てしまう
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Papunto — Gana puntos por tareas y cámbialos por dinero",
    // 下位ページは自分のタイトルだけ書けばよい
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: LOCALE,
    url: "/",
    title: "Papunto — Gana puntos por tareas y cámbialos por dinero",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Papunto — Gana puntos por tareas y cámbialos por dinero",
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  category: "finance",
};

/**
 * 検索結果でサービス名とサイト名を認識させるための構造化データ。
 * ペルー限定のサービスなので areaServed を明示する
 */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: LANG,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      areaServed: { "@type": "Country", name: "Perú" },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={LANG}>
      <head>
        <script
          type="application/ld+json"
          // 定数オブジェクトのみを埋め込む（ユーザー入力は通さない）
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <Providers>
          <div className="flex-1">{children}</div>
          <Footer />
          <AdminFab />
          {/* LPで受け取った招待コードをログイン後に適用する。画面は持たない */}
          <ReferralClaimer />
        </Providers>
      </body>
    </html>
  );
}
