"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";

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

function StatusBadge({ status }: { status: Withdrawal["status"] }) {
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

export default function WalletPage() {
  const { me, token } = useMe();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [postbacks, setPostbacks] = useState<Postback[]>([]);
  const [topups, setTopups] = useState<TopUp[]>([]);

  useEffect(() => {
    if (!token) return;
    getWithdrawals(token).then((r) => setWithdrawals(r.withdrawals)).catch(console.error);
    getPostbacks(token).then((r) => setPostbacks(r.postbacks)).catch(console.error);
    getTopUps(token).then((r) => setTopups(r.topups)).catch(console.error);
  }, [token]);

  const points = me?.points ?? 0;
  const minPoints = me?.min_withdrawal_points ?? 500;
  const rate = me?.points_per_sol ?? 100;
  const pendingWithdrawal = withdrawals.find((w) => w.status === "pending");

  return (
    <div className="min-h-screen w-full bg-neutral-50">
      <Header points={points} />

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Left: points card */}
          <div className="lg:col-span-2">
            <div className="rounded-3xl bg-yellow-400 p-6 sm:p-8">
              <p className="text-sm text-neutral-800">Tus puntos</p>
              <div className="mt-1" style={{ fontSize: "2.25rem", lineHeight: 1 }}>
                {points.toLocaleString("es-PE")} pts
              </div>
              <p className="mt-2 text-xs text-neutral-700">
                {rate.toLocaleString("es-PE")} pts = S/ 1.00 · Mínimo para canjear:{" "}
                {minPoints.toLocaleString("es-PE")} pts
              </p>

              {pendingWithdrawal ? (
                <p className="mt-5 rounded-xl bg-white/50 px-4 py-3 text-center text-sm text-neutral-800">
                  Ya tienes una solicitud de canje en proceso
                </p>
              ) : (
                <Button
                  asChild
                  className="mt-5 h-12 w-full bg-neutral-900 text-white hover:bg-neutral-800"
                >
                  <Link href="/exchange">
                    <ArrowLeftRight className="mr-1 h-4 w-4" />
                    Canjear puntos
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Right: earned / exchanged tabs */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="earned">
              <TabsList>
                <TabsTrigger value="earned">Ganados</TabsTrigger>
                <TabsTrigger value="exchanged">Canjes</TabsTrigger>
                <TabsTrigger value="topups">Recargas</TabsTrigger>
              </TabsList>

              <TabsContent value="earned">
                <div className="mt-4 flex flex-col gap-3">
                  {postbacks.length === 0 && (
                    <p className="text-sm text-neutral-400">
                      Aún no has ganado puntos completando tareas.
                    </p>
                  )}
                  {postbacks.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
                    >
                      <div className="text-neutral-900">
                        +{p.reward_points.toLocaleString("es-PE")} pts
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-400">
                          {new Date(p.created_at).toLocaleDateString("es-PE")}
                        </span>
                        <Badge className="bg-green-100 text-green-700">Recibido</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="exchanged">
                <div className="mt-4 flex flex-col gap-3">
                  {withdrawals.length === 0 && (
                    <p className="text-sm text-neutral-400">
                      Aún no tienes solicitudes de canje.
                    </p>
                  )}
                  {withdrawals.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
                    >
                      <div>
                        <div className="text-neutral-900">
                          {w.points.toLocaleString("es-PE")} pts → S/{" "}
                          {w.amount_soles.toFixed(2)}
                        </div>
                        <div className="text-xs text-neutral-400">
                          {new Date(w.created_at).toLocaleDateString("es-PE")} ·{" "}
                          {w.yape_phone}
                        </div>
                      </div>
                      <StatusBadge status={w.status} />
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="topups">
                <div className="mt-4 flex flex-col gap-3">
                  {topups.length === 0 && (
                    <p className="text-sm text-neutral-400">
                      Aún no tienes recargas.
                    </p>
                  )}
                  {topups.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
                    >
                      <div>
                        <div className="text-neutral-900">
                          {t.points.toLocaleString("es-PE")} pts → S/{" "}
                          {t.amount_soles.toFixed(2)} ({t.operator_name})
                        </div>
                        <div className="text-xs text-neutral-400">
                          {new Date(t.created_at).toLocaleDateString("es-PE")} ·{" "}
                          {t.phone_number}
                        </div>
                      </div>
                      <TopUpStatusBadge status={t.status} />
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
