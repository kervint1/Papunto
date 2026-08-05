"use client";

import { useEffect, useState } from "react";

import { getAdminLogs, type AdminLog, type PageMeta } from "@/lib/api";
import {
  Cell,
  FilterTabs,
  Pagination,
  PageTitle,
  Row,
  TableCard,
  fmtDate,
  useAdminToken,
} from "../ui";

const FILTERS = [
  { id: "", label: "Todas" },
  { id: "withdrawal.approve", label: "Canjes pagados" },
  { id: "withdrawal.reject", label: "Canjes rechazados" },
  { id: "complaint.respond", label: "Reclamos" },
];

export default function AdminLogs() {
  const token = useAdminToken();
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminLog[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getAdminLogs(token, { action: action || undefined, page })
      .then((r) => {
        setRows(r.logs);
        setMeta(r.page);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, action, page]);

  return (
    <>
      <PageTitle
        title="Acciones de admin"
        sub="Quién hizo qué y cuándo. Los canjes no se pueden deshacer, así que todo queda registrado"
      />

      <FilterTabs
        options={FILTERS}
        value={action}
        onChange={(v) => {
          setAction(v);
          setPage(1);
        }}
      />

      <TableCard
        headers={["Fecha", "Admin", "Acción", "Objetivo", "Detalle", "Nota"]}
        loading={loading}
        empty={rows.length === 0}
      >
        {rows.map((l) => (
          <Row key={l.id}>
            <Cell mono className="whitespace-nowrap text-neutral-500">{fmtDate(l.created_at)}</Cell>
            <Cell>{l.admin_email ?? `#${l.admin_user_id}`}</Cell>
            <Cell mono>{l.action}</Cell>
            <Cell mono className="max-w-[12rem] truncate text-neutral-500">
              {l.target_type}/{l.target_id}
            </Cell>
            <Cell>
              <pre className="max-w-[20rem] overflow-x-auto rounded bg-neutral-50 p-2 text-[0.7rem] text-neutral-700">
                {JSON.stringify(l.detail, null, 2)}
              </pre>
            </Cell>
            <Cell className="max-w-[12rem] text-neutral-600">{l.note ?? "—"}</Cell>
          </Row>
        ))}
      </TableCard>

      <Pagination page={meta} onChange={setPage} />
    </>
  );
}
