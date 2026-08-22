"use client";

import { useCallback, useEffect, useState } from "react";

import {
  clearEmailBlock,
  getAdminEmailEvents,
  type AdminEmailEvent,
  type PageMeta,
} from "@/lib/api";
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
  { id: "true", label: "Bloqueados" },
  { id: "false", label: "Todos los eventos" },
];

const LABELS: Record<string, string> = {
  "email.bounced": "Rebotado",
  "email.complained": "Marcado como spam",
  "email.delivered": "Entregado",
};

/** 解除の確認。Resend側にも作業が要ることを、押す前に必ず見せる */
function ClearDialog({
  event,
  onClose,
  onDone,
  token,
}: {
  event: AdminEmailEvent;
  onClose: () => void;
  onDone: () => void;
  token: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await clearEmailBlock(token, event.email);
      onDone();
    } catch {
      setError("No se pudo desbloquear. Inténtalo de nuevo.");
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
        <h2>Desbloquear correo</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Volveremos a enviar correos a <strong>{event.email}</strong>.
        </p>

        {/* ここを書かないと「解除したのに届かない」で必ず詰まる */}
        <div className="mt-4 rounded-xl bg-yellow-50 p-3 text-sm text-neutral-700">
          <strong className="font-semibold text-neutral-900">Esto no basta por sí solo.</strong>{" "}
          También hay que quitar la dirección de la lista de supresión en el panel de Resend.
          Si no, el correo se sigue deteniendo allí.
        </div>

        <p className="mt-3 text-sm text-neutral-600">
          Antes de desbloquear, confirma que el problema esté resuelto (dirección
          escrita mal, buzón lleno). Si sigue rebotando, se vuelve a bloquear solo.
        </p>

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
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {busy ? "Procesando..." : "Desbloquear"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminEmailEvents() {
  const token = useAdminToken();
  const [blockingOnly, setBlockingOnly] = useState("true");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminEmailEvent[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<AdminEmailEvent | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    getAdminEmailEvents(token, { blocking_only: blockingOnly === "true", page })
      .then((r) => {
        setRows(r.events);
        setMeta(r.page);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, blockingOnly, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageTitle
        title="Correos no entregados"
        sub="Estas personas no pueden entrar con el enlace por correo. Solo les queda Google."
      />

      <FilterTabs
        options={FILTERS}
        value={blockingOnly}
        onChange={(v) => {
          setBlockingOnly(v);
          setPage(1);
        }}
      />

      <TableCard
        headers={["Fecha", "Correo", "Qué pasó", "Tipo", "Motivo", ""]}
        loading={loading}
        empty={rows.length === 0}
      >
        {rows.map((e) => (
          <Row key={e.id}>
            <Cell mono className="whitespace-nowrap text-neutral-500">{fmtDate(e.received_at)}</Cell>
            <Cell mono className="max-w-[14rem] truncate">{e.email}</Cell>
            <Cell>{LABELS[e.event_type] ?? e.event_type}</Cell>
            <Cell>
              {/* soft は時間で回復するのでブロックしていない。混同しないよう色を分ける */}
              {e.bounce_type === "soft" ? (
                <span className="text-neutral-500">temporal</span>
              ) : e.bounce_type ? (
                <span className="text-red-600">{e.bounce_type}</span>
              ) : (
                "—"
              )}
            </Cell>
            <Cell className="max-w-[16rem] truncate text-neutral-500">{e.reason ?? "—"}</Cell>
            <Cell>
              {blockingOnly === "true" && (
                <button
                  type="button"
                  onClick={() => setTarget(e)}
                  className="text-xs text-yellow-600 hover:underline"
                >
                  Desbloquear
                </button>
              )}
            </Cell>
          </Row>
        ))}
      </TableCard>

      <Pagination page={meta} onChange={setPage} />

      {target && token && (
        <ClearDialog
          event={target}
          token={token}
          onClose={() => setTarget(null)}
          onDone={() => {
            setTarget(null);
            load();
          }}
        />
      )}
    </>
  );
}
