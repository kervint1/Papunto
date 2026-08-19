"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { getAdminUser, setCampaignExclusion, type AdminUserDetail } from "@/lib/api";

// 台帳のkindを画面の言葉にする。noteがあればそちらを優先する
const KIND_LABEL: Record<string, string> = {
  campaign: "Bono de pre-registro",
  campaign_bonus: "Bono por tareas",
  referral: "Invitación",
  offer: "Tarea completada",
  withdrawal: "Canje por Yape",
  topup: "Recarga",
  refund: "Devolución",
  adjustment: "Ajuste",
};
import {
  Card,
  Cell,
  PageTitle,
  Row,
  StatusBadge,
  TableCard,
  fmtDate,
  fmtPts,
  useAdminToken,
} from "../../ui";

export default function AdminUserDetailPage() {
  const token = useAdminToken();
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!token || !params?.id) return;
    getAdminUser(token, Number(params.id))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [token, params?.id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-neutral-400">Cargando...</p>;

  const u = data.user;

  /**
   * 先着枠の対象から外す／戻す。
   *
   * 外すときは付与済みの報酬も取り消される（サーバー側）。取り消せないと、
   * 管理者や検証用のアカウントが埋めた枠が永久に戻らない。
   */
  const toggleExclusion = async (next: boolean) => {
    if (!token || !data) return;
    setConfirming(false);
    setBusy(true);
    try {
      const campaign = await setCampaignExclusion(token, u.id, next);
      setData({ ...data, campaign });
      // 残高が変わるので取り直す
      getAdminUser(token, u.id).then(setData).catch(console.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Link href="/admin/users" className="text-sm text-neutral-500 hover:underline">
        ← Usuarios
      </Link>
      <div className="mt-2">
        <PageTitle title={u.name ?? u.email} sub={u.email} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-neutral-500">Puntos actuales</div>
          <div className="mt-1 tabular-nums" style={{ fontSize: "1.5rem" }}>
            {fmtPts(u.points)}
          </div>
        </Card>
        <Card className="p-4">
          {/* 会員番号は廃止した（IDはURLにあるので十分）。
              代わりに送金先を出す。不正調査でいちばん見る値 */}
          <div className="text-xs text-neutral-500">Celular (Yape)</div>
          <div className="mt-1 tabular-nums" style={{ fontSize: "1.5rem" }}>
            {u.phone ?? "—"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-neutral-500">Registro</div>
          <div className="mt-1 text-sm">{fmtDate(u.created_at)}</div>
          {u.is_admin && <div className="mt-1 text-xs text-neutral-900">Administrador</div>}
        </Card>
      </div>

      {/* 事前登録キャンペーンの進み具合。報酬は2段なので、
          初回だけ受け取って止まっている人が見分けられる必要がある */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm text-neutral-500">Campaña de pre-registro</h2>
        {/* ⚠️ confirm() は使わない。ネイティブのダイアログはページ全体を止め、
            見た目もこの画面と揃わない。他の破壊的操作（キャンペーン設定の
            「交換を今すぐ開く」）と同じインライン確認にする */}
        <button
          onClick={() =>
            data.campaign.excluded ? toggleExclusion(false) : setConfirming(true)
          }
          disabled={busy}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
        >
          {data.campaign.excluded ? "先着枠に戻す" : "先着枠から外す"}
        </button>
      </div>
      {confirming && (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="text-amber-900">
            先着枠から外し、<strong>付与済みのポイントを取り消します</strong>。
            台帳には取り消しとして記録されます。
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => toggleExclusion(true)}
              disabled={busy}
              className="rounded-lg bg-amber-600 px-4 py-2 text-xs text-white disabled:opacity-50"
            >
              外して取り消す
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <div className="mt-2 grid gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs text-neutral-500">N.° de cupo</div>
          <div className="mt-1 tabular-nums">
            {data.campaign.excluded ? (
              <span className="text-sm text-neutral-500">対象外</span>
            ) : (
              <>
                #{data.campaign.position}
                {!data.campaign.within_limit && (
                  <span className="ml-2 text-xs text-red-600">fuera de cupo</span>
                )}
              </>
            )}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-neutral-500">Bono inicial</div>
          <div className="mt-1 text-sm">
            {data.campaign.reward_granted_at
              ? fmtDate(data.campaign.reward_granted_at)
              : "—"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-neutral-500">Bono por tareas</div>
          <div className="mt-1 text-sm">
            {data.campaign.bonus_granted_at
              ? fmtDate(data.campaign.bonus_granted_at)
              : "—"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-neutral-500">Tareas aprobadas</div>
          <div className="mt-1 tabular-nums">
            {data.campaign.tasks_completed} / {data.campaign.bonus_required_tasks}
          </div>
        </Card>
      </div>

      {/* 招待。自作自演を疑ったときに「誰が誰を招待したか」を辿る入口 */}
      <h2 className="mt-8 text-sm text-neutral-500">Invitaciones</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs text-neutral-500">Su código</div>
          <div className="mt-1 font-mono text-sm tracking-widest">
            {data.referral.code ?? "—"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-neutral-500">Invitado por</div>
          <div className="mt-1 text-sm">
            {data.referral.invited_by_user_id ? (
              <Link
                href={`/admin/users/${data.referral.invited_by_user_id}`}
                className="underline underline-offset-2"
              >
                {data.referral.invited_by_email}
              </Link>
            ) : (
              "—"
            )}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-neutral-500">Invitados</div>
          <div className="mt-1 tabular-nums">
            {data.referral.invited_settled} / {data.referral.invited_total}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-neutral-500">Ganado por invitar</div>
          <div className="mt-1 tabular-nums">{fmtPts(data.referral.earned_points)}</div>
        </Card>
      </div>

      {/* ポイント台帳。増減の理由が1件ずつ残っているので、問い合わせ対応の起点になる */}
      <h2 className="mt-8 text-sm text-neutral-500">Movimientos de puntos</h2>
      {/* ⚠️ 台帳の合計は残高と一致するはず。ズレは「台帳を書かずに残高を
          動かした経路がある」という意味なので、必ず目に入る形で出す */}
      {data.ledger_total !== u.points && (
        <div className="mt-2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          El libro de puntos no cuadra con el saldo. Libro:{" "}
          <strong>{fmtPts(data.ledger_total)}</strong> · Saldo:{" "}
          <strong>{fmtPts(u.points)}</strong> · Diferencia:{" "}
          <strong>{fmtPts(u.points - data.ledger_total)}</strong>
        </div>
      )}
      <div className="mt-2">
        <TableCard
          headers={["Fecha", "Concepto", "Puntos", "Referencia"]}
          empty={data.point_transactions.length === 0}
        >
          {data.point_transactions.map((t) => (
            <Row key={t.id}>
              <Cell>{fmtDate(t.created_at)}</Cell>
              <Cell>{t.note || KIND_LABEL[t.kind] || t.kind}</Cell>
              <Cell>
                <span className={t.points < 0 ? "text-red-600" : "text-neutral-900"}>
                  {t.points > 0 ? "+" : ""}
                  {fmtPts(t.points)}
                </span>
              </Cell>
              <Cell className="text-neutral-400">
                {t.reference_type ? `${t.reference_type} ${t.reference_id ?? ""}` : "—"}
              </Cell>
            </Row>
          ))}
        </TableCard>
      </div>

      <h2 className="mt-8 text-sm text-neutral-500">Conversiones (últimas 50)</h2>
      <div className="mt-2">
        <TableCard
          headers={["Fecha", "Origen", "Campaña", "Puntos", "Estado"]}
          empty={data.postbacks.length === 0}
        >
          {data.postbacks.map((p) => (
            <Row key={p.id}>
              <Cell mono className="whitespace-nowrap text-neutral-500">{fmtDate(p.created_at)}</Cell>
              <Cell>{p.provider}</Cell>
              <Cell>{p.campaign_name ?? "—"}</Cell>
              <Cell mono>{fmtPts(p.reward_points)}</Cell>
              <Cell>
                <StatusBadge status={p.status} />
              </Cell>
            </Row>
          ))}
        </TableCard>
      </div>

      <h2 className="mt-8 text-sm text-neutral-500">Canjes</h2>
      <div className="mt-2">
        <TableCard
          headers={["Fecha", "Yape", "Puntos", "Monto", "Estado"]}
          empty={data.withdrawals.length === 0}
        >
          {data.withdrawals.map((w) => (
            <Row key={w.id}>
              <Cell mono className="whitespace-nowrap text-neutral-500">{fmtDate(w.created_at)}</Cell>
              <Cell mono>{w.yape_phone}</Cell>
              <Cell mono>{fmtPts(w.points)}</Cell>
              <Cell mono>S/ {Number(w.amount_soles).toFixed(2)}</Cell>
              <Cell>
                <StatusBadge status={w.status} />
              </Cell>
            </Row>
          ))}
        </TableCard>
      </div>

      <h2 className="mt-8 text-sm text-neutral-500">Recargas</h2>
      <div className="mt-2">
        <TableCard
          headers={["Fecha", "Número", "Operador", "Puntos", "Monto", "Estado"]}
          empty={data.topups.length === 0}
        >
          {data.topups.map((t) => (
            <Row key={t.id}>
              <Cell mono className="whitespace-nowrap text-neutral-500">{fmtDate(t.created_at)}</Cell>
              <Cell mono>{t.phone_number}</Cell>
              <Cell>{t.operator_name}</Cell>
              <Cell mono>{fmtPts(t.points)}</Cell>
              <Cell mono>S/ {Number(t.amount_soles).toFixed(2)}</Cell>
              <Cell>
                <StatusBadge status={t.status} />
                {t.failure_reason && (
                  <div className="mt-1 max-w-[16rem] text-xs text-red-600">{t.failure_reason}</div>
                )}
              </Cell>
            </Row>
          ))}
        </TableCard>
      </div>
    </>
  );
}
