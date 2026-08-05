"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import {
  actOnWithdrawal,
  getAdminWithdrawals,
  type AdminWithdrawal,
  type PageMeta,
} from "@/lib/api";
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
  { id: "pending", label: "Por procesar" },
  { id: "completed", label: "Pagados" },
  { id: "rejected", label: "Rechazados" },
  { id: "", label: "Todos" },
];

/** 承認・却下は取り消せないので、必ず確認を挟む */
function ConfirmDialog({
  withdrawal,
  action,
  onClose,
  onDone,
}: {
  withdrawal: AdminWithdrawal;
  action: "approve" | "reject";
  onClose: () => void;
  onDone: () => void;
}) {
  const token = useAdminToken();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approving = action === "approve";

  const submit = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await actOnWithdrawal(token, withdrawal.id, action, note || undefined);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2>{approving ? "Marcar como pagado" : "Rechazar solicitud"}</h2>
        <p className="mt-2 text-sm text-neutral-600">
          {approving ? (
            <>
              Confirma que ya enviaste{" "}
              <strong>S/ {withdrawal.amount_soles.toFixed(2)}</strong> por Yape al{" "}
              <strong>{withdrawal.yape_phone}</strong>. Los puntos ya fueron descontados al
              solicitar, así que el saldo no cambia.
            </>
          ) : (
            <>
              Se devolverán <strong>{fmtPts(withdrawal.points)}</strong> al usuario{" "}
              <strong>{withdrawal.user_email ?? withdrawal.user_id}</strong>. No envíes el dinero
              por Yape si rechazas.
            </>
          )}
        </p>

        <label className="mt-4 block text-xs text-neutral-500">
          Nota (queda en el registro de auditoría)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={approving ? "N.° de operación de Yape" : "Motivo del rechazo"}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900"
          />
        </label>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className={`rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50 ${
              approving ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {busy ? "Procesando..." : approving ? "Confirmar pago" : "Rechazar y devolver"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminWithdrawals() {
  const token = useAdminToken();
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminWithdrawal[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ w: AdminWithdrawal; action: "approve" | "reject" } | null>(
    null
  );

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    getAdminWithdrawals(token, { status: status || undefined, page })
      .then((r) => {
        setRows(r.withdrawals);
        setMeta(r.page);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, status, page]);

  useEffect(load, [load]);

  return (
    <>
      <PageTitle title="Canjes (Yape)" sub="Envía el dinero por Yape y luego marca la solicitud" />

      <FilterTabs
        options={FILTERS}
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
      />

      <TableCard
        headers={["Fecha", "Usuario", "Yape", "Puntos", "Monto", "Estado", ""]}
        loading={loading}
        empty={rows.length === 0}
      >
        {rows.map((w) => (
          <Row key={w.id}>
            <Cell mono className="whitespace-nowrap text-neutral-500">{fmtDate(w.created_at)}</Cell>
            <Cell>
              <Link href={`/admin/users/${w.user_id}`} className="text-neutral-900 hover:underline">
                {w.user_email ?? `#${w.user_id}`}
              </Link>
            </Cell>
            <Cell mono>{w.yape_phone}</Cell>
            <Cell mono>{fmtPts(w.points)}</Cell>
            <Cell mono>S/ {w.amount_soles.toFixed(2)}</Cell>
            <Cell>
              <StatusBadge status={w.status} />
            </Cell>
            <Cell>
              {w.status === "pending" && (
                <div className="flex gap-2 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setDialog({ w, action: "approve" })}
                    className="rounded-lg bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
                  >
                    Pagado
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialog({ w, action: "reject" })}
                    className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Rechazar
                  </button>
                </div>
              )}
            </Cell>
          </Row>
        ))}
      </TableCard>

      <Pagination page={meta} onChange={setPage} />

      {dialog && (
        <ConfirmDialog
          withdrawal={dialog.w}
          action={dialog.action}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            load();
          }}
        />
      )}
    </>
  );
}
