"use client";

import { useEffect, useState } from "react";

import { getCampaignSlot, type CampaignSlot, type CampaignStatus } from "@/lib/api";

/**
 * 事前登録の状態。
 *
 * 交換が開くまでの間、`/home` は案件が0件で空になる。**何の説明もないと
 * 「登録したのに何もない」画面**になるので、番号・残高・開放日を出して
 * 「いま何が起きているか」と「次に何が起きるか」を示す。
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

/**
 * `status` は呼び出し元から渡す。同じ画面の進捗カードも開放日で文言が変わるため、
 * 両方が同じ値を見るようにする（別々に取ると片方だけ古い状態になりうる）
 */
export function CampaignCard({
  token,
  status,
}: {
  token: string | undefined;
  status: CampaignStatus | null;
}) {
  const [slot, setSlot] = useState<CampaignSlot | null>(null);

  useEffect(() => {
    if (!token) return;
    getCampaignSlot(token).then(setSlot).catch(() => setSlot(null));
  }, [token]);

  // 交換が開いたら用済み。取得に失敗したときも出さない
  if (!slot || !status || status.withdrawals_open) return null;

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

      {/* 次に何が起きるかを日付で示す。「近日」のような表現は避ける */}
      {status.withdrawals_open_at && (
        <div className="mt-5 rounded-2xl bg-neutral-50 p-4 text-sm">
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
