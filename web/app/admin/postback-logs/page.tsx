"use client";

import { useEffect, useState } from "react";

import { getAdminPostbackLogs, type AdminPostbackLog, type PageMeta } from "@/lib/api";
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
  { id: "", label: "Todos" },
  { id: "false", label: "Rechazados" },
  { id: "true", label: "Verificados" },
];

export default function AdminPostbackLogs() {
  const token = useAdminToken();
  const [verified, setVerified] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminPostbackLog[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getAdminPostbackLogs(token, {
      verified: verified === "" ? undefined : verified === "true",
      page,
    })
      .then((r) => {
        setRows(r.logs);
        setMeta(r.page);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, verified, page]);

  return (
    <>
      <PageTitle
        title="Logs de postback"
        sub="Todo lo que llegó, incluso lo que se rechazó por firma o IP no válida"
      />

      <FilterTabs
        options={FILTERS}
        value={verified}
        onChange={(v) => {
          setVerified(v);
          setPage(1);
        }}
      />

      <TableCard
        headers={["Recibido", "Origen", "Método", "IP", "Transacción", "Firma", ""]}
        loading={loading}
        empty={rows.length === 0}
      >
        {rows.map((l) => (
          <Row key={l.id}>
            <Cell mono className="whitespace-nowrap text-neutral-500">{fmtDate(l.received_at)}</Cell>
            <Cell>{l.provider}</Cell>
            <Cell mono>{l.http_method}</Cell>
            <Cell mono>{l.remote_ip}</Cell>
            <Cell mono className="max-w-[12rem] truncate">{l.transaction_id ?? "—"}</Cell>
            <Cell>
              {l.verified ? (
                <span className="text-green-700">OK</span>
              ) : (
                <span className="text-red-600">Rechazada</span>
              )}
            </Cell>
            <Cell>
              <button
                type="button"
                onClick={() => setOpen(open === l.id ? null : l.id)}
                className="text-xs text-yellow-600 hover:underline"
              >
                {open === l.id ? "Ocultar" : "Payload"}
              </button>
              {open === l.id && (
                <pre className="mt-2 max-w-[26rem] overflow-x-auto rounded-lg bg-neutral-900 p-3 text-[0.7rem] text-neutral-100">
                  {JSON.stringify(l.params, null, 2)}
                </pre>
              )}
            </Cell>
          </Row>
        ))}
      </TableCard>

      <Pagination page={meta} onChange={setPage} />
    </>
  );
}
