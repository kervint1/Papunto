import type { Metadata } from "next";

/** ログイン後の画面。個人の残高や履歴が出るため検索結果に載せない */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
