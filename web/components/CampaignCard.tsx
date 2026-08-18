"use client";

import { useEffect, useState } from "react";

import {
  getCampaignSlot,
  type CampaignSlot,
  type CampaignStatus,
  type ReferralMe,
} from "@/lib/api";

/**
 * 事前登録の状態。
 *
 * 交換が開くまでの間、`/home` は案件が0件で空になる。**何の説明もないと
 * 「登録したのに何もない」画面**になるので、番号・残高・開放日を出して
 * 「いま何が起きているか」と「次に何が起きるか」を示す。
 *
 * 報酬は2段。登録時に300pt、タスクを規定数こなしたら残り200pt。
 * **300ptは最低交換額（500pt）に届かない**ので、残りの200ptが
 * 「引き出せる状態」への最短路として見えている必要がある。ここが
 * 開放日に戻ってくる動機になる。
 *
 * 交換が開いたあとは出さない（役目が終わるため）。
 */
function fmtDate(iso: string): string {
  // "2026-10-01" → "1 de octubre de 2026"
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function CampaignCard({
  token,
  status,
  referral,
}: {
  token: string | undefined;
  status: CampaignStatus | null;
  referral: ReferralMe | null;
}) {
  const [slot, setSlot] = useState<CampaignSlot | null>(null);

  useEffect(() => {
    if (!token) return;
    getCampaignSlot(token).then(setSlot).catch(() => setSlot(null));
  }, [token]);

  // 交換が開いたら用済み。取得に失敗したときも出さない
  if (!slot || !status || status.withdrawals_open) return null;

  const pending = Math.max(0, slot.bonus_required_tasks - slot.tasks_completed);

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8">
      <p className="text-sm text-neutral-500">Pre-registro</p>

      <div className="mt-1 text-neutral-900" style={{ fontSize: "1.75rem", lineHeight: 1.2 }}>
        {slot.within_limit
          ? `Eres el #${slot.position} de ${slot.slot_limit}`
          : "Los cupos se agotaron"}
      </div>

      {slot.within_limit ? (
        <p className="mt-2 text-sm text-neutral-600">
          {/* 付与の実績で出し分ける。枠内でもキャンペーン開始前の登録は未付与 */}
          {slot.reward_granted ? (
            <>
              Ya recibiste{" "}
              <strong className="text-neutral-900">
                {slot.reward_points.toLocaleString("es-PE")} pts
              </strong>{" "}
              por registrarte.
            </>
          ) : (
            <>Tu cupo está reservado.</>
          )}
          {slot.remaining > 0 && ` Quedan ${slot.remaining} cupos.`}
        </p>
      ) : (
        <p className="mt-2 text-sm text-neutral-600">
          Te avisaremos cuando abramos más cupos.
        </p>
      )}

      {/* 誰の招待で入ったか。**中立な事実として**書く。
          招待カード側に置くと「呼んだ人は200pt もらったのに自分は何も無い」
          と読めてしまうので、こちらに寄せている */}
      {referral?.invited_by && (
        <p className="mt-2 text-sm text-neutral-500">
          Entraste con la invitación de{" "}
          <span className="text-neutral-700">{referral.invited_by}</span>.
        </p>
      )}

      {/* 残りの報酬。300ptだけでは canjear できないので、
          「あと何をすれば引き出せるか」を数字で示す */}
      {slot.reward_granted && status.reward_points_bonus > 0 && (
        <div className="mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm">
          {slot.bonus_granted ? (
            <p className="text-neutral-900">
              Ya recibiste tus{" "}
              <strong>{slot.bonus_points.toLocaleString("es-PE")} pts</strong> extra
              por completar tareas.
            </p>
          ) : (
            <>
              <p className="text-neutral-900">
                Te faltan{" "}
                <strong>
                  {status.reward_points_bonus.toLocaleString("es-PE")} pts
                </strong>{" "}
                más
              </p>
              <p className="mt-1 text-neutral-700">
                Completa {pending}{" "}
                {pending === 1 ? "tarea" : "tareas"} cuando abramos y te los
                damos. Así llegas al mínimo para canjear.
              </p>
            </>
          )}
        </div>
      )}

      {/* 次に何が起きるかを日付で示す。「近日」のような表現は避ける */}
      {status.withdrawals_open_at && (
        <div className="mt-4 rounded-2xl bg-neutral-50 p-4 text-sm">
          <p className="text-neutral-900">
            El canje se abre el{" "}
            <strong>{fmtDate(status.withdrawals_open_at)}</strong>
          </p>
          <p className="mt-1 text-neutral-600">
            Hasta entonces no tienes que hacer nada.
            {/* 未付与の人に「ポイントは保存済み」と言わない */}
            {slot.reward_granted && " Tus puntos ya están guardados en tu cuenta."}
          </p>
        </div>
      )}

      <a
        href="/campana"
        className="mt-4 inline-block text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
      >
        Ver bases de la campaña
      </a>
    </div>
  );
}
