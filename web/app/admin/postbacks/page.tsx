"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getAdminPostbacks, type AdminPostback, type PageMeta } from "@/lib/api";
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
  { id: "pending", label: "En revisión" },
  { id: "approved", label: "Aprobadas" },
  { id: "rejected", label: "Rechazadas" },
];

export default function AdminPostbacks() {
  const token = useAdminToken();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminPostback[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getAdminPostbacks(token, { status: status || undefined, page })
      .then((r) => {
        setRows(r.postbacks);
        setMeta(r.page);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, status, page]);

  return (
    <>
      <PageTitle
        title="Conversiones"
        sub="Resultados recibidos por postback. Solo suman al saldo cuando están aprobadas"
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
        headers={["Fecha", "Origen", "Usuario", "Campaña", "Puntos", "Payout", "Estado"]}
        loading={loading}
        empty={rows.length === 0}
      >
        {rows.map((p) => (
          <Row key={p.id}>
            <Cell mono className="whitespace-nowrap text-neutral-500">{fmtDate(p.created_at)}</Cell>
            <Cell>{p.provider}</Cell>
            <Cell>
              <Link href={`/admin/users/${p.user_id}`} className="hover:underline">
                {p.user_email ?? `#${p.user_id}`}
              </Link>
            </Cell>
            <Cell>
              <div>{p.campaign_name ?? "—"}</div>
              <div className="text-xs text-neutral-400">{p.transaction_id}</div>
            </Cell>
            <Cell mono>{fmtPts(p.reward_points)}</Cell>
            <Cell mono className="text-neutral-500">
              {p.payout_usd === null ? "—" : `$${Number(p.payout_usd).toFixed(2)}`}
            </Cell>
            <Cell>
              <StatusBadge status={p.status} />
            </Cell>
          </Row>
        ))}
      </TableCard>

      <Pagination page={meta} onChange={setPage} />
    </>
  );
}
