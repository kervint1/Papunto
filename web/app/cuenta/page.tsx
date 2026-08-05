"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  ArrowLeftRight,
  BookOpen,
  Check,
  ChevronRight,
  Cookie,
  Copy,
  FileText,
  LogOut,
  Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe } from "@/hooks/useMe";
import {
  getPostbacks,
  getTopUps,
  getWithdrawals,
  type Postback,
  type TopUp,
  type Withdrawal,
} from "@/lib/api";

const LEGAL_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/terminos", label: "Términos de uso", icon: FileText },
  { href: "/privacidad", label: "Política de privacidad", icon: Shield },
  { href: "/cookies", label: "Política de cookies", icon: Cookie },
  { href: "/reclamaciones", label: "Libro de reclamaciones", icon: BookOpen },
];

// ポイント明細の絞り込み。成果の3状態にそのまま対応する
const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "pending", label: "En revisión" },
  { id: "approved", label: "Aprobados" },
  { id: "rejected", label: "Rechazados" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function PostbackStatusBadge({ status }: { status: Postback["status"] }) {
  if (status === "approved") {
    return <Badge className="bg-green-100 text-green-700">Aprobado</Badge>;
  }
  if (status === "rejected") {
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

/** 会員番号のコピーボタン。押すと一時的にチェックマークへ変わる */
function CopyNumber({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label="Copiar número de miembro"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-50"
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
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
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [topups, setTopups] = useState<TopUp[]>([]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([getPostbacks(token), getWithdrawals(token), getTopUps(token)])
      .then(([p, w, t]) => {
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

  const filteredPostbacks = useMemo(
    () => (filter === "all" ? postbacks : postbacks.filter((p) => p.status === filter)),
    [postbacks, filter]
  );

  const memberNumber = me ? String(me.id).padStart(8, "0") : "";

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

          <div className="mt-3 flex items-center gap-3 border-t border-neutral-100 pt-3">
            <span className="text-xs text-neutral-500">N.° de miembro</span>
            <span className="tabular-nums text-sm text-neutral-900">{memberNumber || "—"}</span>
            {memberNumber && <CopyNumber value={memberNumber} />}
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

              <div className="mt-3 flex flex-col gap-2">
                {filteredPostbacks.length === 0 ? (
                  <EmptyRow>No hay movimientos en esta vista.</EmptyRow>
                ) : (
                  filteredPostbacks.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl bg-white p-4"
                    >
                      <div className="min-w-0">
                        <div className="tabular-nums text-neutral-900">
                          +{p.reward_points.toLocaleString("es-PE")} pts
                        </div>
                        <div className="truncate text-xs text-neutral-400">
                          {new Date(p.created_at).toLocaleDateString("es-PE")}
                          {p.campaign_name ? ` · ${p.campaign_name}` : ""}
                        </div>
                      </div>
                      <PostbackStatusBadge status={p.status} />
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

        {/* 4. 設定・規約 */}
        <section className="mt-6">
          <h2 className="px-1 text-xs text-neutral-500">Ayuda y legal</h2>
          <div className="mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            {LEGAL_LINKS.map(({ href, label, icon: Icon }, i) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-neutral-50 ${
                  i > 0 ? "border-t border-neutral-100" : ""
                }`}
              >
                <Icon className="h-5 w-5 shrink-0 text-neutral-400" />
                <span className="flex-1 text-sm text-neutral-900">{label}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
              </Link>
            ))}
          </div>
        </section>

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
