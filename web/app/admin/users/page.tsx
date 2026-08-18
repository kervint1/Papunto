"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getAdminUsers, type AdminUser, type PageMeta } from "@/lib/api";
import { Cell, Pagination, PageTitle, Row, TableCard, fmtDate, fmtPts, useAdminToken } from "../ui";

export default function AdminUsers() {
  const token = useAdminToken();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getAdminUsers(token, { q: query || undefined, page })
      .then((r) => {
        setRows(r.users);
        setMeta(r.page);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, query, page]);

  return (
    <>
      <PageTitle title="Usuarios" sub="Busca por correo, nombre o celular" />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q);
          setPage(1);
        }}
        className="mb-3 flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="correo, nombre o 987654321"
          className="w-full max-w-sm rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white">
          Buscar
        </button>
      </form>

      <TableCard
        headers={["ID", "Usuario", "Puntos", "Registro", ""]}
        loading={loading}
        empty={rows.length === 0}
      >
        {rows.map((u) => (
          <Row key={u.id}>
            <Cell mono className="text-neutral-500">{u.id}</Cell>
            <Cell>
              <div className="text-neutral-900">{u.name ?? "—"}</div>
              <div className="text-xs text-neutral-500">{u.email}</div>
              {u.is_admin && (
                <span className="mt-1 inline-block rounded bg-neutral-900 px-1.5 text-[0.65rem] text-white">
                  admin
                </span>
              )}
            </Cell>
            <Cell mono>{fmtPts(u.points)}</Cell>
            <Cell mono className="whitespace-nowrap text-neutral-500">{fmtDate(u.created_at)}</Cell>
            <Cell>
              <Link href={`/admin/users/${u.id}`} className="text-sm text-yellow-600 hover:underline">
                Ver
              </Link>
            </Cell>
          </Row>
        ))}
      </TableCard>

      <Pagination page={meta} onChange={setPage} />
    </>
  );
}
