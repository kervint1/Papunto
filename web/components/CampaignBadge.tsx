"use client";

import { useEffect, useState } from "react";

import { getCampaignStatus, type CampaignStatus } from "@/lib/api";

/**
 * 事前登録の残り枠。
 *
 * 認証なしで取得できるAPIを使う。**希少性が拡散の動機になる**ので、
 * ログイン前のLPで見せる必要がある。
 *
 * 取得に失敗したら何も出さない（枠の情報が出ないだけで、LP自体は成立する）。
 */
export function CampaignBadge() {
  const [status, setStatus] = useState<CampaignStatus | null>(null);

  useEffect(() => {
    getCampaignStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!status) return null;

  const full = status.remaining <= 0;

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span
        className={`inline-block rounded-full px-3 py-1 text-sm ${
          full ? "bg-neutral-200 text-neutral-600" : "bg-neutral-900 text-white"
        }`}
      >
        {full
          ? `Cupos agotados (${status.slot_limit}/${status.slot_limit})`
          : `Quedan ${status.remaining} de ${status.slot_limit} cupos`}
      </span>
      {/* 条件を必ず読めるようにする。除外条件を事前に示すのは
          INDECOPI（消費者保護）の観点でも必要 */}
      <a
        href="/campana"
        onClick={(e) => e.stopPropagation()}
        className="text-xs text-neutral-700 underline underline-offset-2"
      >
        Ver bases
      </a>
    </span>
  );
}
