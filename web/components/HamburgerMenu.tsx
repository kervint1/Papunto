"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useValidSession } from "@/hooks/useMe";
import { Menu, X } from "lucide-react";

import { getPostbacks, type Postback } from "@/lib/api";

type Item = { href: string; label: string; sub?: string };

const MAIN: Item[] = [
  { href: "/cuenta", label: "Mi cuenta" },
  { href: "/cuenta", label: "Historial de puntos", sub: "Revisa el estado de cada tarea" },
  { href: "/exchange", label: "Canjear puntos", sub: "Recibe tu dinero en Yape" },
  { href: "/exchange/recarga", label: "Recarga de celular", sub: "Claro, Movistar, Entel y Bitel" },
];

const EARN: Item[] = [
  { href: "/home", label: "Tareas disponibles", sub: "Completa tareas y gana puntos" },
];

const LEGAL: Item[] = [
  { href: "/terminos", label: "Términos de uso" },
  { href: "/privacidad", label: "Política de privacidad" },
  { href: "/cookies", label: "Política de cookies" },
  { href: "/reclamaciones", label: "Libro de reclamaciones" },
];

function Group({
  title,
  items,
  onNavigate,
}: {
  title?: string;
  items: Item[];
  onNavigate: () => void;
}) {
  return (
    <div className="mt-5">
      {title && <h3 className="px-1 text-xs text-neutral-500">{title}</h3>}
      <div className="mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {items.map((item, i) => (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            onClick={onNavigate}
            className={`block px-4 py-3 transition-colors hover:bg-neutral-50 ${
              i > 0 ? "border-t border-neutral-100" : ""
            }`}
          >
            <div className="text-sm text-neutral-900">{item.label}</div>
            {item.sub && <div className="mt-0.5 text-xs text-neutral-400">{item.sub}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-t border-white/40 py-2 first:border-t-0">
      <span className="text-xs text-neutral-800">{label}</span>
      <span className="tabular-nums text-sm text-neutral-900">{value}</span>
    </div>
  );
}

export function HamburgerMenu({ points, name }: { points: number; name?: string | null }) {
  const [open, setOpen] = useState(false);
  const [postbacks, setPostbacks] = useState<Postback[] | null>(null);
  const { session } = useValidSession();
  const pathname = usePathname();

  const close = () => setOpen(false);

  // 開いたときだけ取りに行く。全ページのヘッダーに載るので、閉じている間は通信しない
  useEffect(() => {
    if (!open || postbacks !== null || !session?.apiToken) return;
    getPostbacks(session.apiToken)
      .then((r) => setPostbacks(r.postbacks))
      .catch(() => setPostbacks([]));
  }, [open, postbacks, session?.apiToken]);

  // 画面遷移したら閉じる
  useEffect(close, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const { monthPoints, pendingPoints } = useMemo(() => {
    const rows = postbacks ?? [];
    const now = new Date();
    return {
      // 承認日そのものはAPIが返していないため、成果の受信日で今月分を数えている
      monthPoints: rows
        .filter((p) => p.status === "approved")
        .filter((p) => {
          const d = new Date(p.created_at);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        })
        .reduce((s, p) => s + p.reward_points, 0),
      pendingPoints: rows
        .filter((p) => p.status === "pending")
        .reduce((s, p) => s + p.reward_points, 0),
    };
  }, [postbacks]);

  const fmt = (n: number) => `${n.toLocaleString("es-PE")} pts`;

  return (
    <>
      <button
        type="button"
        aria-label="Menú"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900 text-white transition-colors hover:bg-neutral-700"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={close}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
            className="absolute right-0 top-0 flex h-full w-[min(20rem,88vw)] flex-col overflow-y-auto bg-neutral-50 shadow-xl"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-neutral-500">Menú</span>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={close}
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 pb-6">
              {/* ユーザーサマリ */}
              <div className="rounded-2xl bg-yellow-400 p-4">
                <p className="text-sm text-neutral-900">
                  Hola, {name ?? "usuario"}
                </p>
                <div className="mt-2">
                  <StatRow label="Puntos disponibles" value={fmt(points)} />
                  <StatRow
                    label="Ganados este mes"
                    value={postbacks === null ? "—" : fmt(monthPoints)}
                  />
                  <StatRow
                    label="En revisión"
                    value={postbacks === null ? "—" : fmt(pendingPoints)}
                  />
                </div>
              </div>

              <Group items={MAIN} onNavigate={close} />
              <Group title="Ganar puntos" items={EARN} onNavigate={close} />
              <Group title="Ayuda y legal" items={LEGAL} onNavigate={close} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
