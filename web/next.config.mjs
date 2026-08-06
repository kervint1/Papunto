/** @type {import('next').NextConfig} */

// メディアサイト（別リポジトリ papunto-pandia）の本番URL。
// 設定すると /blog 配下がそちらへ転送され、同一ドメイン配信になる（Next.js Multi-Zones）。
// 未設定なら何もしないので、ローカルや未接続の環境でも問題なく動く
const MEDIA_URL = process.env.MEDIA_URL;

const nextConfig = {
  async rewrites() {
    if (!MEDIA_URL) return [];
    // メディア側は basePath: "/blog" なので、転送先にも /blog を付ける
    return [
      { source: "/blog", destination: `${MEDIA_URL}/blog` },
      { source: "/blog/:path*", destination: `${MEDIA_URL}/blog/:path*` },
    ];
  },
};

export default nextConfig;
