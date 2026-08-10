"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useMe } from "@/hooks/useMe";

const DISMISS_KEY = "papunto.adminFab.dismissed";

/**
 * 管理者にだけ出る、管理画面へのショートカット。
 *
 * `is_admin` を見てから描画するので、一般ユーザーには存在自体が見えない。
 * 閉じるとタブを閉じるまで出てこない（sessionStorage）。localStorageにすると
 * 一度消したきり戻せなくなるため
 */
export function AdminFab() {
  const { me } = useMe();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(true); // 判定前は出さない

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  // 管理画面の中では邪魔にしかならない
  if (!me?.is_admin || dismissed || pathname.startsWith("/admin")) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-1 rounded-full bg-neutral-900 py-2 pl-4 pr-2 text-white shadow-lg">
      <Link href="/admin" className="text-sm hover:underline">
        管理画面
      </Link>
      <button
        type="button"
        aria-label="閉じる"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-800 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}
