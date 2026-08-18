"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ApiError,
  getCampaignSettings,
  updateCampaignSettings,
  type AdminCampaignSettings,
} from "@/lib/api";
import { Card, PageTitle, fmtDate, useAdminToken } from "../ui";

/**
 * キャンペーン設定。**環境変数ではなくここで変える**。
 *
 * 枠数はキャンペーン中に増やす想定（100→200）、開放日はリリースがずれれば動く。
 * 環境変数だと変更のたびに Heroku の設定変更と再起動が要るため、DBに置いて
 * ここから変えられるようにしている。変更は監査ログに残る。
 */
export default function AdminCampaign() {
  const token = useAdminToken();
  const [data, setData] = useState<AdminCampaignSettings | null>(null);
  const [slotLimit, setSlotLimit] = useState("");
  const [rewardPoints, setRewardPoints] = useState("");
  const [openAt, setOpenAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const apply = useCallback((s: AdminCampaignSettings) => {
    setData(s);
    setSlotLimit(String(s.slot_limit));
    setRewardPoints(String(s.reward_points));
    setOpenAt(s.withdrawals_open_at ?? "");
  }, []);

  useEffect(() => {
    if (!token) return;
    getCampaignSettings(token).then(apply).catch(console.error);
  }, [token, apply]);

  const save = async (confirmOpenNow = false) => {
    if (!token) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await updateCampaignSettings(token, {
        slot_limit: Number(slotLimit),
        reward_points: Number(rewardPoints),
        withdrawals_open_at: openAt || null,
        confirm_open_now: confirmOpenNow,
      });
      apply(next);
      setSaved(true);
    } catch (e) {
      // 開放日を空にした場合は、内容を説明したうえで確認ボタンを出す
      if (e instanceof ApiError && e.code === "CONFIRM_OPEN_NOW_REQUIRED") {
        setError("CONFIRM_OPEN_NOW");
      } else if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError("Error de conexión");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <>
        <PageTitle title="Campaña" />
        <Card className="p-6 text-sm text-neutral-400">Cargando...</Card>
      </>
    );
  }

  const dirty =
    Number(slotLimit) !== data.slot_limit ||
    Number(rewardPoints) !== data.reward_points ||
    (openAt || null) !== data.withdrawals_open_at;

  return (
    <>
      <PageTitle
        title="Campaña"
        sub="Pre-registro: cupos, premio y fecha de apertura del canje"
      />

      {/* 現況。設定を変える前に「いま何人に配ったか」が見えている必要がある */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-neutral-500">Premios otorgados</p>
          <p className="mt-1 text-xl">{data.granted_count}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-neutral-500">Usuarios totales</p>
          <p className="mt-1 text-xl">{data.users_total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-neutral-500">Cupos libres</p>
          <p className="mt-1 text-xl">{Math.max(0, data.slot_limit - data.users_total)}</p>
        </Card>
      </div>

      <Card className="p-6">
        <div className="grid gap-5 sm:max-w-md">
          <label className="block">
            <span className="text-sm text-neutral-700">Cupos</span>
            <input
              type="number"
              min={data.granted_count || 1}
              value={slotLimit}
              onChange={(e) => setSlotLimit(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            {/* 付与が始まる前は下限が無いので出さない */}
            {data.granted_count > 0 && (
              <span className="mt-1 block text-xs text-neutral-500">
                No puede bajar de {data.granted_count} (premios ya otorgados).
              </span>
            )}
          </label>

          <label className="block">
            <span className="text-sm text-neutral-700">Premio por registro (pts)</span>
            <input
              type="number"
              min={0}
              value={rewardPoints}
              onChange={(e) => setRewardPoints(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Solo afecta a los registros futuros. 100 pts = S/ 1.
            </span>
          </label>

          <label className="block">
            <span className="text-sm text-neutral-700">Apertura del canje</span>
            <input
              type="date"
              value={openAt}
              onChange={(e) => setOpenAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Vacío = canje abierto de inmediato. Debe coincidir con lo anunciado
              en la landing.
            </span>
          </label>
        </div>

        {error === "CONFIRM_OPEN_NOW" ? (
          <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
            <p className="text-amber-900">
              Al dejar la fecha vacía, todos los usuarios podrán canjear de
              inmediato. ¿Continuar?
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => save(true)}
                disabled={busy}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Sí, abrir el canje ahora
              </button>
              <button
                onClick={() => setError(null)}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          error && <p className="mt-4 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => save()}
            disabled={busy || !dirty}
            className="rounded-lg bg-neutral-900 px-5 py-2 text-sm text-white disabled:opacity-40"
          >
            {busy ? "Guardando..." : "Guardar"}
          </button>
          {saved && !dirty && <span className="text-sm text-green-600">Guardado</span>}
        </div>

        {data.updated_at && (
          <p className="mt-4 text-xs text-neutral-400">
            Último cambio: {fmtDate(data.updated_at)}
            {data.updated_by_email && ` · ${data.updated_by_email}`}
          </p>
        )}
      </Card>
    </>
  );
}
