"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { InviteCard } from "@/components/InviteCard";
import { InviteCodeEntry } from "@/components/InviteCodeEntry";
import { Logo } from "@/components/Logo";
import { PhoneGate } from "@/components/PhoneGate";
import { getPhone, type CampaignSlot, type CampaignStatus, type ReferralMe } from "@/lib/api";

/**
 * 事前登録中に見せる画面。**アプリのホームは見せない。**
 *
 * 交換が開くまでの44日間、中にはタスクが1件も無い。空のアプリを見せると
 * 「登録したのに何もない」になるので、**待機リストの確認ページ**として扱う。
 *
 * ここでできることは3つだけ。
 * 1. 枠が取れたことの確認
 * 2. 友達を招待する
 * 3. 電話番号を先に登録する（＝300ptを受け取る）
 */
function fmtDate(iso: string): string {
  // "2026-10-01" と "2026-08-29T10:15:00+00:00" の両方が来る。
  // 後者をそのまま split("-") すると日の部分が "29T10:15:00+00:00" になり NaN
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function PreRegistroView({
  token,
  status,
  slot,
  referral,
  points,
  onClaimed,
}: {
  token: string | undefined;
  status: CampaignStatus;
  slot: CampaignSlot;
  referral: ReferralMe | null;
  points: number;
  /** コードを適用したら呼ぶ。呼び出し側で referral を取り直す */
  onClaimed?: () => void;
}) {
  const [phone, setPhone] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;
    getPhone(token)
      .then((s) => setPhone(s.phone ?? null))
      .catch(() => setPhone(null))
      .finally(() => setLoaded(true));
  }, [token]);

  const total = status.reward_points_initial + status.reward_points_bonus;
  const opensAt = status.withdrawals_open_at;

  return (
    <div className="min-h-screen w-full bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto w-full max-w-2xl px-6 py-4">
          <Logo />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 py-8">
        {/* 1. 枠が取れたことの確認 */}
        <div className="rounded-3xl bg-yellow-400 p-6 sm:p-8">
          <p className="text-sm text-neutral-800">Pre-registro</p>
          <div
            className="mt-1 text-neutral-900"
            style={{ fontSize: "1.75rem", lineHeight: 1.2 }}
          >
            {slot.within_limit
              ? `Estás dentro de los ${slot.slot_limit}`
              : "Los cupos se agotaron"}
          </div>
          {slot.within_limit && (
            <p className="mt-2 text-neutral-800">
              Reservamos{" "}
              <strong>S/ {(total / 100).toFixed(2)}</strong> para ti.
              {slot.remaining > 0 && ` Quedan ${slot.remaining} cupos.`}
            </p>
          )}
          {referral?.invited_by && (
            <p className="mt-2 text-sm text-neutral-800">
              Entraste con la invitación de {referral.invited_by}.
            </p>
          )}
        </div>

        {/* 2. 電話番号。ここが300ptを受け取る条件 */}
        {loaded && (
          <div className="mt-4 rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8">
            {phone ? (
              <>
                {/* ⚠️ 総残高ではなく**キャンペーンで付与された額**を出す。
                    残高には招待報酬なども混ざるので、それを
                    「キャンペーンの報酬」として見せると嘘になる */}
                <p className="inline-flex items-center gap-2 text-sm text-neutral-600">
                  <Check className="h-4 w-4 text-green-600" />
                  {slot.reward_granted
                    ? `Ya recibiste tus ${slot.reward_points.toLocaleString("es-PE")} pts`
                    : "Tu número está registrado"}
                </p>
                <p className="mt-1 font-mono text-lg tracking-wider text-neutral-900">
                  {phone}
                </p>
                <p className="mt-2 text-sm text-neutral-600">
                  Tu saldo es{" "}
                  <strong className="text-neutral-900">
                    {points.toLocaleString("es-PE")} pts
                  </strong>
                  . Podrás canjearlo desde el{" "}
                  <strong className="text-neutral-900">
                    {opensAt ? fmtDate(opensAt) : "lanzamiento"}
                  </strong>
                  .
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-neutral-500">Siguiente paso</p>
                <div
                  className="mt-1 text-neutral-900"
                  style={{ fontSize: "1.5rem", lineHeight: 1.25 }}
                >
                  Recibe tus {status.reward_points_initial} pts ahora
                </div>
                <p className="mt-2 text-sm text-neutral-600">
                  Registra el número de Yape donde recibirás tu dinero y te
                  acreditamos los puntos al instante.
                </p>

                {/* ⚠️ 期限を必ず出す。規約（/campana）に書いてあっても、
                    画面に出さずに枠を消すのは不親切。ここが唯一
                    「いつまでに何をすればいいか」が伝わる場所 */}
                {slot.reservation_deadline && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Tu cupo está reservado hasta el{" "}
                    <strong className="font-semibold">
                      {fmtDate(slot.reservation_deadline)}
                    </strong>
                    . Si no registras tu número antes, el cupo pasa a otra
                    persona.
                  </p>
                )}
                <div className="mt-4">
                  <PhoneGate token={token} onRegistered={setPhone} />
                </div>
              </>
            )}
          </div>
        )}

        {/* 3. 招待コードの入力。
            ⚠️ **ここに置かないと、ログイン後にコードを入れる手段が無くなる。**
               リンク経由（?ref=）はWhatsAppやFacebookのアプリ内ブラウザで
               壊れる（Googleが外部ブラウザに飛ばすのでlocalStorageが失われる）。
               手入力がその迂回路なので、事前登録中こそ必要 */}
        {referral?.can_claim && onClaimed && (
          <div className="mt-4">
            <InviteCodeEntry token={token} data={referral} onClaimed={onClaimed} />
          </div>
        )}

        {/* 4. 招待 */}
        <div className="mt-4">
          <InviteCard data={referral} />
        </div>

        {/* 何が起きるかを時系列で。44日の空白を隠さない */}
        <div className="mt-4 rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8">
          <p className="text-sm text-neutral-500">Qué sigue</p>
          <ol className="mt-3 space-y-3 text-sm text-neutral-700">
            <li>
              <strong className="text-neutral-900">
                {opensAt ? fmtDate(opensAt) : "En el lanzamiento"}
              </strong>{" "}
              — abrimos las tareas y el canje. Te avisamos por correo.
            </li>
            <li>
              Completa 1 tarea y recibes{" "}
              <strong className="text-neutral-900">
                {status.reward_points_bonus} pts
              </strong>{" "}
              más.
            </li>
            <li>
              Desde{" "}
              <strong className="text-neutral-900">
                {total.toLocaleString("es-PE")} pts
              </strong>{" "}
              puedes cobrar por Yape.
            </li>
          </ol>
          <p className="mt-4 text-sm text-neutral-500">
            Hasta entonces no tienes que hacer nada más.
          </p>
          <a
            href="/campana"
            className="mt-4 inline-block text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
          >
            Ver bases de la campaña
          </a>
        </div>
      </main>
    </div>
  );
}
