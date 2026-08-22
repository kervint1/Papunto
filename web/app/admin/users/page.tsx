"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getAdminUsers, type AdminUser, type PageMeta } from "@/lib/api";
import {
  Cell,
  FilterTabs,
  Pagination,
  PageTitle,
  Row,
  TableCard,
  fmtDate,
  fmtPts,
  useAdminToken,
} from "../ui";

/**
 * 先着キャンペーンの対象者。10/1に誰へ払うのかを確定させる作業で使う。
 *
 * ⚠️ 絞り込みはサーバー側で campaign_service と同じ条件を使っている
 *    （退会・除外を数えない）。ここで独自に数えないこと。
 */
const FILTERS = [
  { id: "", label: "Todos" },
  { id: "reserved", label: "Con cupo" },
  { id: "granted", label: "Ya premiados" },
  { id: "pending", label: "Falta celular" },
  { id: "excluded", label: "Excluidos" },
];

export default function AdminUsers() {
  const token = useAdminToken();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [campaign, setCampaign] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getAdminUsers(token, {
      q: query || undefined,
      campaign: campaign || undefined,
      page,
    })
      .then((r) => {
        setRows(r.users);
        setMeta(r.page);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, query, campaign, page]);

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

      <FilterTabs
        options={FILTERS}
        value={campaign}
        onChange={(v) => {
          setCampaign(v);
          setPage(1);
        }}
      />

      {/* 絞り込み中は登録順に並ぶ。新しい順だと「何番目までが枠内か」が読めない */}
      {campaign && meta && (
        <p className="mb-2 text-xs text-neutral-500">
          {meta.total} 件・登録順
        </p>
      )}

      <TableCard
        headers={["ID", "Usuario", "Celular", "Puntos", "Registro", ""]}
        loading={loading}
        empty={rows.length === 0}
      >
        {rows.map((u) => (
          <Row key={u.id}>
            <Cell mono className="text-neutral-500">{u.id}</Cell>
            <Cell>
              <div className="text-neutral-900">{u.name ?? "—"}</div>
              <div className="text-xs text-neutral-500">{u.email}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {u.is_admin && (
                  <span className="rounded bg-neutral-900 px-1.5 text-[0.65rem] text-white">
                    admin
                  </span>
                )}
                {u.suspended_at && (
                  <span className="rounded bg-red-600 px-1.5 text-[0.65rem] text-white">
                    suspendido
                  </span>
                )}
                {u.deleted_at && (
                  <span className="rounded bg-neutral-400 px-1.5 text-[0.65rem] text-white">
                    eliminado
                  </span>
                )}
              </div>
            </Cell>
            {/* 送金先。10/1に払うときいちばん見る値 */}
            <Cell mono className="whitespace-nowrap text-neutral-500">{u.phone ?? "—"}</Cell>
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
