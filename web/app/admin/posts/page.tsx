"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  createAdminPost,
  getAdminPosts,
  setPostPublished,
  type AdminPost,
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
  useAdminToken,
} from "../ui";

const FILTERS = [
  { id: "", label: "Todos" },
  { id: "draft", label: "Borradores" },
  { id: "published", label: "Publicados" },
];

export default function AdminPosts() {
  const token = useAdminToken();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminPost[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    getAdminPosts(token, { status: status || undefined, q: query || undefined, page })
      .then((r) => {
        setRows(r.posts);
        setMeta(r.page);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, status, query, page]);

  useEffect(load, [load]);

  const toggle = async (post: AdminPost) => {
    if (!token) return;
    const publishing = post.status !== "published";
    if (!publishing && !confirm(`「${post.title}」を非公開にしますか？`)) return;
    setBusy(post.id);
    try {
      await setPostPublished(token, post.id, publishing);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  };

  const createNew = async () => {
    if (!token) return;
    const post = await createAdminPost(token, { title: "Nuevo artículo" });
    router.push(`/admin/posts/${post.id}`);
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageTitle title="Artículos" sub="Blog Pandia. Se publican en /blog" />
        <button
          type="button"
          onClick={createNew}
          className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800"
        >
          Nuevo artículo
        </button>
      </div>

      <FilterTabs
        options={FILTERS}
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
      />

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
          placeholder="Buscar por título o URL"
          className="w-full max-w-sm rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white">
          Buscar
        </button>
      </form>

      <TableCard
        headers={["Título", "URL", "Estado", "Publicado", "Actualizado", ""]}
        loading={loading}
        empty={rows.length === 0}
      >
        {rows.map((p) => (
          <Row key={p.id}>
            <Cell>
              <Link href={`/admin/posts/${p.id}`} className="text-neutral-900 hover:underline">
                {p.title}
              </Link>
              {p.description && (
                <div className="max-w-[24rem] truncate text-xs text-neutral-400">
                  {p.description}
                </div>
              )}
            </Cell>
            <Cell mono className="max-w-[14rem] truncate text-neutral-500">
              {p.status === "published" ? (
                <a
                  href={`/blog/posts/${p.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  /{p.slug}
                </a>
              ) : (
                `/${p.slug}`
              )}
            </Cell>
            <Cell>
              <StatusBadge status={p.status === "published" ? "approved" : "pending"} />
            </Cell>
            <Cell mono className="whitespace-nowrap text-neutral-500">
              {p.published_at ? fmtDate(p.published_at) : "—"}
            </Cell>
            <Cell mono className="whitespace-nowrap text-neutral-500">
              {fmtDate(p.updated_at)}
            </Cell>
            <Cell>
              <button
                type="button"
                disabled={busy === p.id}
                onClick={() => toggle(p)}
                className={`whitespace-nowrap rounded-lg px-3 py-1 text-xs disabled:opacity-50 ${
                  p.status === "published"
                    ? "border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                {busy === p.id ? "..." : p.status === "published" ? "Despublicar" : "Publicar"}
              </button>
            </Cell>
          </Row>
        ))}
      </TableCard>

      <Pagination page={meta} onChange={setPage} />
    </>
  );
}
