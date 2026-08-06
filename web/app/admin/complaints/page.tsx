"use client";

import { useCallback, useEffect, useState } from "react";

import { getAdminComplaints, respondComplaint, type AdminComplaint, type PageMeta } from "@/lib/api";
import {
  Cell,
  FilterTabs,
  Pagination,
  PageTitle,
  Row,
  StatusBadge,
  TableCard,
  fmtDate,
  useAdminToken,
} from "../ui";

const FILTERS = [
  { id: "pendiente", label: "Pendientes" },
  { id: "respondido", label: "Respondidas" },
  { id: "", label: "Todas" },
];

export default function AdminComplaints() {
  const token = useAdminToken();
  const [status, setStatus] = useState("pendiente");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminComplaint[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    getAdminComplaints(token, { status: status || undefined, page })
      .then((r) => {
        setRows(r.complaints);
        setMeta(r.page);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, status, page]);

  useEffect(load, [load]);

  const respond = async (c: AdminComplaint) => {
    if (!token) return;
    // 法令上、応答したこと自体が記録として要る。押し間違いを防ぐため確認を挟む
    if (!confirm(`¿Marcar como respondida la hoja N.° ${c.number ?? "—"}? Esta acción queda registrada.`))
      return;
    setBusy(c.id);
    try {
      await respondComplaint(token, c.id);
      load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageTitle
        title="Libro de reclamaciones"
        sub="Indecopi exige responder cada hoja. Marca como respondida cuando hayas contactado al consumidor"
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
        headers={["N.°", "Fecha", "Tipo", "Consumidor", "Bien", "Estado", ""]}
        loading={loading}
        empty={rows.length === 0}
      >
        {rows.map((c) => (
          <Row key={c.id}>
            <Cell mono className="text-neutral-500">{c.number ?? "—"}</Cell>
            <Cell mono className="whitespace-nowrap text-neutral-500">{fmtDate(c.created_at)}</Cell>
            <Cell>{c.tipo}</Cell>
            <Cell>
              <div className="text-neutral-900">{c.consumidor_nombre}</div>
              <div className="text-xs text-neutral-500">{c.consumidor_email}</div>
              {c.consumidor_telefono && (
                <div className="text-xs text-neutral-500">{c.consumidor_telefono}</div>
              )}
            </Cell>
            <Cell className="max-w-[14rem]">
              <div>{c.bien_descripcion}</div>
              <button
                type="button"
                onClick={() => setOpen(open === c.id ? null : c.id)}
                className="mt-1 text-xs text-yellow-600 hover:underline"
              >
                {open === c.id ? "Ocultar detalle" : "Ver detalle"}
              </button>
              {open === c.id && (
                <div className="mt-2 space-y-2 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-700">
                  <div>
                    <span className="text-neutral-400">Detalle:</span> {c.detalle}
                  </div>
                  <div>
                    <span className="text-neutral-400">Pedido:</span> {c.pedido}
                  </div>
                  {c.monto_reclamado !== null && (
                    <div>
                      <span className="text-neutral-400">Monto:</span> S/{" "}
                      {Number(c.monto_reclamado).toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </Cell>
            <Cell>
              <StatusBadge status={c.status} />
            </Cell>
            <Cell>
              {c.status === "pendiente" && (
                <button
                  type="button"
                  disabled={busy === c.id}
                  onClick={() => respond(c)}
                  className="whitespace-nowrap rounded-lg bg-neutral-900 px-3 py-1 text-xs text-white disabled:opacity-50"
                >
                  {busy === c.id ? "..." : "Respondida"}
                </button>
              )}
            </Cell>
          </Row>
        ))}
      </TableCard>

      <Pagination page={meta} onChange={setPage} />
    </>
  );
}
