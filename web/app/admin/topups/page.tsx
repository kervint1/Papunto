"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getAdminTopUps, type AdminTopUp, type PageMeta } from "@/lib/api";
import {
  Cell,
  FilterTabs,
  Pagination,
  PageTitle,
  Row,
  StatusBadge,
  TableCard,
  fmtDate,
  fmtPts,
  useAdminToken,
} from "../ui";

const FILTERS = [
  { id: "", label: "Todas" },
  { id: "processing", label: "En proceso" },
  { id: "completed", label: "Completadas" },
  { id: "failed", label: "Fallidas" },
];

export default function AdminTopUps() {
  const token = useAdminToken();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminTopUp[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getAdminTopUps(token, { status: status || undefined, page })
      .then((r) => {
        setRows(r.topups);
        setMeta(r.page);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, status, page]);

  return (
    <>
      <PageTitle
        title="Recargas de celular"
        sub="Se procesan automáticamente vía Reloadly. Si algo queda en proceso, revisa el panel de Reloadly"
      />

      <FilterTabs
        options={FILTERS}
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
      />

      <TableCard
        headers={["Fecha", "Usuario", "Número", "Operador", "Puntos", "Monto", "Estado"]}
        loading={loading}
        empty={rows.length === 0}
      >
        {rows.map((t) => (
          <Row key={t.id}>
            <Cell mono className="whitespace-nowrap text-neutral-500">{fmtDate(t.created_at)}</Cell>
            <Cell>
              <Link href={`/admin/users/${t.user_id}`} className="hover:underline">
                {t.user_email ?? `#${t.user_id}`}
              </Link>
            </Cell>
            <Cell mono>{t.phone_number}</Cell>
            <Cell>{t.operator_name}</Cell>
            <Cell mono>{fmtPts(t.points)}</Cell>
            <Cell mono>S/ {t.amount_soles.toFixed(2)}</Cell>
            <Cell>
              <StatusBadge status={t.status} />
              {t.failure_reason && (
                <div className="mt-1 max-w-[16rem] text-xs text-red-600">{t.failure_reason}</div>
              )}
            </Cell>
          </Row>
        ))}
      </TableCard>

      <Pagination page={meta} onChange={setPage} />
    </>
  );
}
