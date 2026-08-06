import type { Metadata } from "next";

import { AdminShell } from "./AdminShell";

export const metadata: Metadata = {
  title: "Admin",
  // 運営データが出る画面なので検索結果には絶対に載せない
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
