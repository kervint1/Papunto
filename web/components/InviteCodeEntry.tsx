"use client";

import { useEffect, useState } from "react";

import { ApiError, claimReferral, type ReferralMe } from "@/lib/api";
import { clearRef, notifyClaimed, pendingRef } from "@/lib/referral";

/**
 * 招待コードの手入力。**独立したカード**として招待カードより前に置く。
 *
 * ⚠️ **リンク（?ref=）だけでは足りない**。ペルーの共有はWhatsApp中心だが、
 *    WhatsAppのアプリ内ブラウザでリンクを開くと、Googleがアプリ内WebViewでの
 *    OAuthを拒否する（disallowed_useragent）。ユーザーは外部ブラウザに移され、
 *    そこは別のブラウザなので localStorage に保存したコードが失われる。
 *    手入力はこの経路を丸ごと迂回する。
 *
 * ⚠️ 「友達を招待して稼ごう」のカードの中に入れないこと。あれは**招待する側**の
 *    画面で、コードを打ちたい人（招待された側）が探す場所ではない。
 *    スクロールしないと見えない位置に置くと、リンクが壊れた人が復帰できない。
 */
const MESSAGES: Record<string, string> = {
  CODE_NOT_FOUND: "Ese código no existe. Revísalo e intenta de nuevo.",
  SELF_REFERRAL: "No puedes usar tu propio código.",
  ALREADY_INVITED: "Ya usaste un código de invitación.",
  CLAIM_WINDOW_CLOSED: "El código solo se puede usar al crear la cuenta.",
  INVALID_CODE: "Código inválido.",
};

export function InviteCodeEntry({
  token,
  data,
  onClaimed,
}: {
  token: string | undefined;
  data: ReferralMe | null;
  onClaimed: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // リンクから来たのに自動適用が通らなかった場合（通信エラーなど）、
  // 拾ったコードを初期値として入れておく。ユーザーは押すだけで済む。
  //
  // ⚠️ useState の初期値にしないこと。サーバー側描画では localStorage が
  //    無く空になるため、ハイドレーションでずれる
  useEffect(() => {
    const pending = pendingRef();
    if (pending) setCode(pending);
  }, []);

  if (!data || !data.can_claim) return null;

  const submit = async () => {
    if (!token || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await claimReferral(token, code);
      clearRef(); // リンク経由で保存済みのコードが残っていても、もう用済み
      notifyClaimed();
      onClaimed();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? MESSAGES[e.code] ?? e.message
          : "Error de conexión"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8">
      <p className="text-sm text-neutral-500">¿Un amigo te invitó?</p>
      <div className="mt-1 text-neutral-900" style={{ fontSize: "1.5rem", lineHeight: 1.25 }}>
        Escribe su código
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        Así tu amigo recibe sus {data.reward_points} pts. Si no tienes código,
        puedes ignorar esto.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={code}
          // 大文字に寄せる。コードは大文字で配るので、小文字で打つと
          // 「合っているのに違って見える」状態になる（サーバー側でも吸収している）
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Ej. P62EWW9P"
          maxLength={12}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="h-11 w-full rounded-xl border border-neutral-300 px-4 font-mono tracking-widest text-neutral-900 sm:w-56"
        />
        <button
          onClick={submit}
          disabled={busy || !code.trim()}
          className="h-11 rounded-xl bg-neutral-900 px-6 text-sm text-white disabled:opacity-40"
        >
          {busy ? "Verificando..." : "Aplicar"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
