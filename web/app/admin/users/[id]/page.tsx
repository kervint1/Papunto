"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { getAdminUser, type AdminUserDetail } from "@/lib/api";
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

  useEffect(() => {
    if (!token || !params?.id) return;
    getAdminUser(token, Number(params.id))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [token, params?.id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-neutral-400">Cargando...</p>;

  const u = data.user;

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
          <div className="text-xs text-neutral-500">N.° de miembro</div>
          <div className="mt-1 tabular-nums" style={{ fontSize: "1.5rem" }}>
            {u.id}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-neutral-500">Registro</div>
          <div className="mt-1 text-sm">{fmtDate(u.created_at)}</div>
          {u.is_admin && <div className="mt-1 text-xs text-neutral-900">Administrador</div>}
        </Card>
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
