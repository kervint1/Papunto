"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getMe, type Me } from "@/lib/api";

/**
 * ログイン中でも apiToken を持たないセッションが残ることがある。
 * （サインイン時にバックエンド呼び出しが失敗した古いセッションなど）
 * その状態だとAPIを一度も呼べず画面が永久に読み込み中になるため、畳んでログインし直させる
 */
export function useValidSession() {
  const { data: session, status } = useSession();
  const broken = status === "authenticated" && !session?.apiToken;

  useEffect(() => {
    if (broken) signOut({ callbackUrl: "/ingresar?error=SessionExpired" });
  }, [broken]);

  return { session, status, token: session?.apiToken, broken };
}

/** ログイン必須ページ用: 未ログインなら/loginへ、ログイン済みなら/meを取得する */
export function useMe() {
  const { session, status, token } = useValidSession();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/ingresar");
      return;
    }
    if (token) {
      getMe(token).then(setMe).catch(console.error);
    }
  }, [status, token, router]);

  return { me, token, refresh: () => token && getMe(token).then(setMe) };
}
