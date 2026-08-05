"use client";

import { useEffect, useState } from "react";

import { getAdminOffers, type Offer } from "@/lib/api";
import { Cell, PageTitle, Row, TableCard, fmtPts, useAdminToken } from "../ui";

export default function AdminOffers() {
  const token = useAdminToken();
  const [rows, setRows] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getAdminOffers(token)
      .then((r) => setRows(r.offers))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <>
      <PageTitle
        title="Ofertas (CPALead)"
        sub="Se leen del proveedor en cada carga. No se guardan en nuestra base de datos"
      />

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TableCard
        headers={["ID", "Título", "Condición", "Dispositivo", "Puntos"]}
        loading={loading}
        empty={rows.length === 0}
      >
        {rows.map((o) => (
          <Row key={o.campaign_id}>
            <Cell mono className="text-neutral-500">{o.campaign_id}</Cell>
            <Cell>
              <a
                href={o.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-900 hover:underline"
              >
                {o.title}
              </a>
              {o.description && (
                <div className="max-w-[24rem] text-xs text-neutral-400">{o.description}</div>
              )}
            </Cell>
            <Cell className="max-w-[16rem] text-neutral-600">{o.conversion ?? "—"}</Cell>
            <Cell className="text-neutral-500">{o.device ?? "—"}</Cell>
            <Cell mono>{fmtPts(o.points)}</Cell>
          </Row>
        ))}
      </TableCard>
    </>
  );
}
