"use client";

import { useValidSession } from "@/hooks/useMe";
import { Badge } from "@/components/ui/badge";
import type { PageMeta } from "@/lib/api";

/** 管理APIを叩くためのトークン。AdminShellが認証済みを保証している */
export function useAdminToken() {
  const { token } = useValidSession();
  return token;
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h1>{title}</h1>
      {sub && <p className="mt-1 text-sm text-neutral-500">{sub}</p>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-neutral-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

/** 一覧の枠。横に長い表はカード内でだけ横スクロールさせ、ページ自体は横に伸ばさない */
export function TableCard({
  headers,
  children,
  empty,
  loading,
}: {
  headers: string[];
  children: React.ReactNode;
  empty?: boolean;
  loading?: boolean;
}) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              {headers.map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-2.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={headers.length} className="px-4 py-10 text-center text-neutral-400">
                  Cargando...
                </td>
              </tr>
            ) : empty ? (
              <tr>
                <td colSpan={headers.length} className="px-4 py-10 text-center text-neutral-400">
                  No hay registros.
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">{children}</tr>;
}

export function Cell({
  children,
  mono,
  className = "",
}: {
  children: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 align-top ${mono ? "tabular-nums" : ""} ${className}`}>{children}</td>
  );
}

const STATUS_STYLES: Record<string, string> = {
  // 進行中・未処理
  pending: "bg-amber-100 text-amber-700",
  pendiente: "bg-amber-100 text-amber-700",
  processing: "bg-amber-100 text-amber-700",
  // 完了
  completed: "bg-green-100 text-green-700",
  approved: "bg-green-100 text-green-700",
  respondido: "bg-green-100 text-green-700",
  // 失敗・却下
  rejected: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600"}>{status}</Badge>;
}

export function FilterTabs({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
            value === o.id
              ? "bg-neutral-900 text-white"
              : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Pagination({
  page,
  onChange,
}: {
  page: PageMeta | null;
  onChange: (p: number) => void;
}) {
  if (!page || page.total <= page.per_page) return null;
  const last = Math.ceil(page.total / page.per_page);
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-neutral-600">
      <span className="tabular-nums">
        {(page.page - 1) * page.per_page + 1}–{Math.min(page.page * page.per_page, page.total)} de{" "}
        {page.total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page.page <= 1}
          onClick={() => onChange(page.page - 1)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1 disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={page.page >= last}
          onClick={() => onChange(page.page + 1)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1 disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

export function fmtPts(n: number) {
  return `${n.toLocaleString("es-PE")} pts`;
}
