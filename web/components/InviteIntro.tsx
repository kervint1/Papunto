"use client";

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";

import { checkReferralCode } from "@/lib/api";
import { pendingRef, saveRef } from "@/lib/referral";

/**
 * LPに置く、**ログイン前**の招待コード確認。
 *
 * 登録の前に「ちゃんと友達に入るのか」を確かめられるようにする。
 * 先に登録させると、入ったかどうか分からないまま進ませることになる。
 *
 * 2つの入り方に対応する。
 * - リンク（?ref=）で来た人 … 確認だけ見せる。入力させない
 * - コードだけ聞いた人 … 折りたたんだ入力欄。**コードを持たない人には出さない**
 *   （大半は持っていないので、既定で開くと登録の邪魔になる）
 */
export function InviteIntro() {
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);

  const verify = useCallback(async (raw: string) => {
    const value = raw.trim().toUpperCase();
    if (!value) return;
    setBusy(true);
    setInvalid(false);
    try {
      const res = await checkReferralCode(value);
      if (res.valid) {
        setName(res.inviter_name ?? "tu amigo");
        // 確認できたものだけ保存する。ログイン後に自動で適用される
        saveRef(value);
      } else {
        setInvalid(true);
      }
    } catch {
      // 通信が不安定なだけかもしれない。保存はしておき、ログイン後に再試行させる
      saveRef(value);
      setName(null);
    } finally {
      setBusy(false);
    }
  }, []);

  // リンクで来た場合は、開く前に確認まで済ませておく
  useEffect(() => {
    const stored = pendingRef();
    if (stored) {
      setCode(stored);
      verify(stored);
    }
  }, [verify]);

  if (name) {
    return (
      <div
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/60 px-4 py-2 text-sm text-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        <Check className="h-4 w-4" />
        Te invitó <strong>{name}</strong> · recibirá sus puntos al registrarte
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="mt-4 block text-sm text-neutral-800 underline underline-offset-2"
      >
        ¿Tienes un código de invitación?
      </button>
    );
  }

  return (
    <div className="mt-4 max-w-sm" onClick={(e) => e.stopPropagation()}>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && verify(code)}
          placeholder="Ej. P62EWW9P"
          maxLength={12}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="h-11 w-full rounded-xl border border-neutral-900/20 bg-white px-4 font-mono tracking-widest text-neutral-900"
        />
        <button
          onClick={() => verify(code)}
          disabled={busy || !code.trim()}
          className="h-11 shrink-0 rounded-xl bg-neutral-900 px-5 text-sm text-white disabled:opacity-40"
        >
          {busy ? "..." : "Verificar"}
        </button>
      </div>
      {invalid && (
        <p className="mt-2 text-sm text-red-700">
          Ese código no existe. Revísalo con tu amigo.
        </p>
      )}
    </div>
  );
}
