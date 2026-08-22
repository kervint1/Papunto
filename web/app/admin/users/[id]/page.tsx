"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  deleteUserAsAdmin,
  getAdminUser,
  setCampaignExclusion,
  setUserAdmin,
  setUserSuspension,
  type AdminUserDetail,
} from "@/lib/api";

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
  const [adminConfirming, setAdminConfirming] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);

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
   * 管理者権限の付け外し。
   *
   * ⚠️ 自分自身は変更できない（サーバー側で400）。降格して管理者が0人に
   *    なると、DBを直接触るまで誰も入れなくなる。
   */
  const toggleAdmin = async (next: boolean) => {
    if (!token || !data) return;
    setAdminConfirming(false);
    setBusy(true);
    setError(null);
    try {
      const user = await setUserAdmin(token, data.user.id, next);
      setData({ ...data, user });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  /** 凍結／解除。使わせないだけなので取り消せる */
  const toggleSuspension = async (next: boolean) => {
    if (!token || !data) return;
    setBusy(true);
    setError(null);
    try {
      const user = await setUserSuspension(token, data.user.id, next);
      setData({ ...data, user });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  /**
   * 削除。**取り消せない**。
   *
   * 本人から削除の請求があった場合に使う（ペルーの Ley 29733 は削除権を
   * 認めており、本人がメールにアクセスできないと自分では消せない）。
   * 不正への対処は凍結を使う。
   */
  const removeUser = async () => {
    if (!token || !data) return;
    setDeleteConfirming(false);
    setBusy(true);
    setError(null);
    try {
      await deleteUserAsAdmin(token, data.user.id);
      getAdminUser(token, data.user.id).then(setData).catch(console.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

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

      {/* 管理者権限。元々はDBから直接UPDATEする運用だった（管理画面が
          乗っ取られても管理者を増やされないようにするため）。画面から
          行えるようにした以上、操作は必ず admin_logs に残る */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm text-neutral-500">Permiso de administrador</h2>
        <button
          onClick={() => (u.is_admin ? toggleAdmin(false) : setAdminConfirming(true))}
          disabled={busy}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
        >
          {u.is_admin ? "管理者から外す" : "管理者にする"}
        </button>
      </div>
      {/* 凍結と削除。用途が違うので並べて出す。
          凍結 = 使わせない（取り消せる）／削除 = 個人情報を落とす（戻せない） */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm text-neutral-500">Cuenta</h2>
        <div className="flex gap-2">
          <button
            onClick={() => toggleSuspension(!u.suspended_at)}
            disabled={busy || !!u.deleted_at}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            {u.suspended_at ? "凍結を解除" : "凍結する"}
          </button>
          <button
            onClick={() => setDeleteConfirming(true)}
            disabled={busy || !!u.deleted_at}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            削除する
          </button>
        </div>
      </div>
      {u.deleted_at && (
        <p className="mt-2 text-sm text-neutral-500">
          {fmtDate(u.deleted_at)} に削除済み
        </p>
      )}
      {u.suspended_at && !u.deleted_at && (
        <p className="mt-2 text-sm text-red-600">
          {fmtDate(u.suspended_at)} から凍結中。ログインできません
        </p>
      )}
      {deleteConfirming && (
        <div className="mt-2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm">
          <p className="text-red-900">
            <strong>{u.email}</strong> のメール・氏名・電話番号を消し、
            <strong>残っているポイントを失効させます</strong>。
            <strong>取り消せません。</strong>
          </p>
          <p className="mt-2 text-red-900">
            使わせないだけなら「凍結する」を使ってください。
            削除は、本人から削除の請求があった場合に使います。
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={removeUser}
              disabled={busy}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs text-white disabled:opacity-50"
            >
              削除する
            </button>
            <button
              onClick={() => setDeleteConfirming(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {adminConfirming && (
        <div className="mt-2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm">
          <p className="text-red-900">
            <strong>{u.email}</strong> が管理画面に入れるようになります。
            換金の承認、キャンペーン設定の変更、他のユーザーの権限変更が
            すべて可能になります。
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => toggleAdmin(true)}
              disabled={busy}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs text-white disabled:opacity-50"
            >
              管理者にする
            </button>
            <button
              onClick={() => setAdminConfirming(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

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
