"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

import { ApiError, claimReferral } from "@/lib/api";
import { clearRef, notifyClaimed, pendingRef } from "@/lib/referral";

/**
 * 再試行しても結果が変わらないエラー。これらはコードを捨ててよい。
 * 逆に通信エラーは**捨てない** — 捨てると手入力の初期値にも出せなくなり、
 * ユーザーが自力で復帰する手段が消える
 */
const TERMINAL = new Set([
  "CODE_NOT_FOUND",
  "SELF_REFERRAL",
  "ALREADY_INVITED",
  "CLAIM_WINDOW_CLOSED",
  "INVALID_CODE",
]);

/**
 * LPで受け取った招待コードを、**ログイン後に一度だけ**適用する。
 *
 * 画面を持たない。招待が付いても付かなくてもユーザーの操作は変わらないので、
 * 成否をその場で見せずに黙って処理する（失敗の大半は「もう使った」
 * 「期限切れ」で、どちらも本人にできることが無い）。
 *
 * ⚠️ useMe() ではなく useSession() を使う。useMe() は未ログインを /login へ
 *    飛ばすので、これを共通レイアウトに置くと全ページがログイン必須になる。
 */
export function ReferralClaimer() {
  const { status, data } = useSession();
  const token = data?.apiToken;
  const done = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !token || done.current) return;
    const code = pendingRef();
    if (!code) return;

    done.current = true;
    claimReferral(token, code)
      .then(() => {
        clearRef();
        notifyClaimed();
      })
      .catch((e) => {
        if (e instanceof ApiError && TERMINAL.has(e.code)) {
          clearRef();
          // 「もう招待されている」場合も画面の表示を更新する必要がある
          notifyClaimed();
        }
        // 通信エラーはコードを残す。手入力の欄に初期値として出る
      });
  }, [status, token]);

  return null;
}
