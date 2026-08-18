"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ArrowLeftRight, Check, Copy, LogOut } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe } from "@/hooks/useMe";
import {
  getPointHistory,
  getPostbacks,
  getTopUps,
  getWithdrawals,
  type PointTransaction,
  type Postback,
  type TopUp,
  type Withdrawal,
} from "@/lib/api";

// ポイント明細の絞り込み。
//
// 「確定」は**台帳（point_transactions）**から来る。キャンペーン報酬・招待報酬・
// 案件の成果を同じ形で扱うため。「審査中」「却下」は残高に入っていないので
// 台帳には無く、postbacks から拾う
const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "confirmed", label: "Confirmados" },
  { id: "pending", label: "En revisión" },
  { id: "rejected", label: "Rechazados" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

/** 明細1行。台詞は出どころが違っても同じ形にそろえる */
type Movement = {
  key: string;
  points: number;
  label: string;
  createdAt: string;
  state: "confirmed" | "pending" | "rejected";
};

// 台帳のkindを画面の言葉にする。noteがあればそちらを優先する
const KIND_LABEL: Record<string, string> = {
  campaign: "Bono de pre-registro",
  referral: "Invitación",
  offer: "Tarea completada",
  refund: "Devolución",
  adjustment: "Ajuste",
};

/** 明細の状態。「確定」は残高に入っている＝台帳にある、という意味 */
function MovementStateBadge({ state }: { state: Movement["state"] }) {
  if (state === "confirmed") {
    return <Badge className="bg-green-100 text-green-700">En tu saldo</Badge>;
  }
  if (state === "rejected") {
    return <Badge className="bg-red-100 text-red-700">Rechazado</Badge>;
  }
  return <Badge className="bg-amber-100 text-amber-700">En revisión</Badge>;
}

function WithdrawalStatusBadge({ status }: { status: Withdrawal["status"] }) {
  if (status === "completed") {
    return <Badge className="bg-green-100 text-green-700">Pagado</Badge>;
  }
  if (status === "rejected") {
    return <Badge className="bg-red-100 text-red-700">Rechazado</Badge>;
  }
  return <Badge className="bg-amber-100 text-amber-700">Pendiente</Badge>;
}

function TopUpStatusBadge({ status }: { status: TopUp["status"] }) {
  if (status === "completed") {
    return <Badge className="bg-green-100 text-green-700">Recargado</Badge>;
  }
  if (status === "failed") {
    return <Badge className="bg-red-100 text-red-700">Fallido</Badge>;
  }
  return <Badge className="bg-amber-100 text-amber-700">Procesando</Badge>;
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-4 py-10 text-center text-sm text-neutral-400">
      {children}
    </div>
  );
}

export default function CuentaPage() {
  const { me, token } = useMe();
  const [postbacks, setPostbacks] = useState<Postback[]>([]);
  const [ledger, setLedger] = useState<PointTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [topups, setTopups] = useState<TopUp[]>([]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [month, setMonth] = useState<string>("all"); // "all" または "YYYY-MM"
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      getPointHistory(token),
      getPostbacks(token),
      getWithdrawals(token),
      getTopUps(token),
    ])
      .then(([l, p, w, t]) => {
        setLedger(l.transactions);
        setPostbacks(p.postbacks);
        setWithdrawals(w.withdrawals);
        setTopups(t.topups);
        setUpdatedAt(new Date());
      })
      .catch(console.error);
  }, [token]);

  const points = me?.points ?? 0;
  const minPoints = me?.min_withdrawal_points ?? 500;
  const rate = me?.points_per_sol ?? 100;
  const soles = points / rate;
  const pendingWithdrawal = withdrawals.find((w) => w.status === "pending");

  // 判定中ポイント: 成果は届いているが広告主の承認待ちで、まだ残高に入っていない分
  const pendingPoints = useMemo(
    () =>
      postbacks
        .filter((p) => p.status === "pending")
        .reduce((sum, p) => sum + p.reward_points, 0),
    [postbacks]
  );

  // 獲得の明細。**台帳が主**で、そこに残高未反映のものを足す。
  //
  // 承認済みの成果は台帳に offer として入っているので、postbacks からは
  // 拾わない（拾うと二重に出る）
  const movements = useMemo<Movement[]>(() => {
    const fromLedger: Movement[] = ledger
      .filter((t) => t.points > 0)
      .map((t) => ({
        key: `l${t.id}`,
        points: t.points,
        label: t.note || KIND_LABEL[t.kind] || "Movimiento",
        createdAt: t.created_at,
        state: "confirmed" as const,
      }));

    const fromPostbacks: Movement[] = postbacks
      .filter((p) => p.status !== "approved")
      .map((p) => ({
        key: `p${p.id}`,
        points: p.reward_points,
        label: p.campaign_name || "Tarea completada",
        createdAt: p.created_at,
        state: p.status === "rejected" ? ("rejected" as const) : ("pending" as const),
      }));

    return [...fromLedger, ...fromPostbacks].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }, [ledger, postbacks]);

  // 履歴に存在する月だけをタブに出す（新しい順）
  const months = useMemo(() => {
    const keys = Array.from(new Set(movements.map((m) => m.createdAt.slice(0, 7))));
    return keys.sort().reverse();
  }, [movements]);

  const filteredMovements = useMemo(
    () =>
      movements
        .filter((m) => filter === "all" || m.state === filter)
        .filter((m) => month === "all" || m.createdAt.slice(0, 7) === month),
    [movements, filter, month]
  );

  return (
    <div className="min-h-screen w-full bg-neutral-50">
      <Header points={points} avatarUrl={me?.avatar_url} name={me?.name} email={me?.email} />

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {/* 1. アカウント */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Avatar src={me?.avatar_url} name={me?.name} email={me?.email} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-neutral-900">{me?.name ?? "—"}</div>
              <div className="truncate text-sm text-neutral-500">{me?.email ?? ""}</div>
            </div>
          </div>

        </div>

        {/* 2. ポイント */}
        <div className="mt-4 rounded-2xl bg-yellow-400 p-6">
          <p className="text-sm text-neutral-800">Puntos disponibles</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span style={{ fontSize: "2.25rem", lineHeight: 1 }} className="tabular-nums">
              {points.toLocaleString("es-PE")}
            </span>
            <span className="text-sm text-neutral-800">pts</span>
            <span className="ml-auto text-sm text-neutral-800">≈ S/ {soles.toFixed(2)}</span>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-white/50 px-4 py-3">
            <span className="text-sm text-neutral-800">Puntos en revisión</span>
            <span className="tabular-nums text-sm text-neutral-800">
              {pendingPoints.toLocaleString("es-PE")} pts
            </span>
          </div>

          {pendingWithdrawal ? (
            <p className="mt-3 rounded-xl bg-white/50 px-4 py-3 text-center text-sm text-neutral-800">
              Ya tienes una solicitud de canje en proceso
            </p>
          ) : (
            <Button
              asChild
              className="mt-3 h-12 w-full bg-neutral-900 text-white hover:bg-neutral-800"
            >
              <Link href="/exchange">
                <ArrowLeftRight className="mr-1 h-4 w-4" />
                Canjear puntos
              </Link>
            </Button>
          )}
          <p className="mt-2 text-center text-xs text-neutral-700">
            Mínimo para canjear: {minPoints.toLocaleString("es-PE")} pts
          </p>
        </div>

        {/* 3. 通帳 */}
        <section className="mt-4 rounded-2xl bg-yellow-50 p-4 sm:p-5">
          <div className="flex items-baseline justify-between">
            <h2>Historial de puntos</h2>
            {updatedAt && (
              <span className="text-xs text-neutral-500">
                Al {updatedAt.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}
              </span>
            )}
          </div>

          <Tabs defaultValue="earned" className="mt-3">
            <TabsList>
              <TabsTrigger value="earned">Ganados</TabsTrigger>
              <TabsTrigger value="exchanged">Canjes</TabsTrigger>
              <TabsTrigger value="topups">Recargas</TabsTrigger>
            </TabsList>

            <TabsContent value="earned">
              {/* 状態フィルタ */}
              <div className="mt-4 flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                      filter === f.id
                        ? "bg-neutral-900 text-white"
                        : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* 月別タブ */}
              {months.length > 0 && (
                <div className="mt-3 flex gap-1 overflow-x-auto border-b border-neutral-200">
                  {["all", ...months].map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-current={month === m ? "true" : undefined}
                      onClick={() => setMonth(m)}
                      className={`shrink-0 px-3 pb-2 text-sm transition-colors ${
                        month === m
                          ? "border-b-2 border-neutral-900 text-neutral-900"
                          : "text-neutral-500 hover:text-neutral-900"
                      }`}
                    >
                      {m === "all"
                        ? "Todo"
                        : new Date(`${m}-01T00:00:00`).toLocaleDateString("es-PE", {
                            month: "short",
                            year: "2-digit",
                          })}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-col gap-2">
                {filteredMovements.length === 0 ? (
                  <EmptyRow>No hay movimientos en esta vista.</EmptyRow>
                ) : (
                  filteredMovements.map((m) => (
                    <div
                      key={m.key}
                      className="flex items-center justify-between rounded-xl bg-white p-4"
                    >
                      <div className="min-w-0">
                        <div className="tabular-nums text-neutral-900">
                          +{m.points.toLocaleString("es-PE")} pts
                        </div>
                        <div className="truncate text-xs text-neutral-400">
                          {new Date(m.createdAt).toLocaleDateString("es-PE")} · {m.label}
                        </div>
                      </div>
                      <MovementStateBadge state={m.state} />
                    </div>
                  ))
                )}
              </div>

              <p className="mt-3 text-xs text-neutral-500">
                Cuando confirmamos que completaste una tarea, los puntos aparecen aquí{" "}
                <span className="text-red-600">
                  en revisión, y se suman a tu saldo solo cuando el anunciante los aprueba.
                </span>
              </p>
            </TabsContent>

            <TabsContent value="exchanged">
              <div className="mt-4 flex flex-col gap-2">
                {withdrawals.length === 0 ? (
                  <EmptyRow>Aún no tienes solicitudes de canje.</EmptyRow>
                ) : (
                  withdrawals.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between rounded-xl bg-white p-4"
                    >
                      <div className="min-w-0">
                        <div className="tabular-nums text-neutral-900">
                          {w.points.toLocaleString("es-PE")} pts → S/ {w.amount_soles.toFixed(2)}
                        </div>
                        <div className="truncate text-xs text-neutral-400">
                          {new Date(w.created_at).toLocaleDateString("es-PE")} · {w.yape_phone}
                        </div>
                      </div>
                      <WithdrawalStatusBadge status={w.status} />
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="topups">
              <div className="mt-4 flex flex-col gap-2">
                {topups.length === 0 ? (
                  <EmptyRow>Aún no tienes recargas.</EmptyRow>
                ) : (
                  topups.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-xl bg-white p-4"
                    >
                      <div className="min-w-0">
                        <div className="tabular-nums text-neutral-900">
                          {t.points.toLocaleString("es-PE")} pts → S/{" "}
                          {t.amount_soles.toFixed(2)} ({t.operator_name})
                        </div>
                        <div className="truncate text-xs text-neutral-400">
                          {new Date(t.created_at).toLocaleDateString("es-PE")} · {t.phone_number}
                        </div>
                      </div>
                      <TopUpStatusBadge status={t.status} />
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </section>

        {/* 規約類はハンバーガーメニューに集約したため、ここにはログアウトだけを置く */}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 text-sm text-red-600 shadow-sm transition-colors hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </main>
    </div>
  );
}
