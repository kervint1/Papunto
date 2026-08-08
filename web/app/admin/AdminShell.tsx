"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ArrowLeftRight,
  ClipboardList,
  FileText,
  FileWarning,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  Smartphone,
  Target,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { getAdminStats, getMe, type AdminStats, type Me } from "@/lib/api";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** サイドバーに出す未処理件数。運用でまず見る数字をメニュー上で示す */
  badge?: (s: AdminStats) => number;
};

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "General",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Operación",
    items: [
      {
        href: "/admin/withdrawals",
        label: "Canjes (Yape)",
        icon: ArrowLeftRight,
        badge: (s) => s.withdrawals_pending,
      },
      {
        href: "/admin/topups",
        label: "Recargas",
        icon: Smartphone,
        badge: (s) => s.topups_processing,
      },
      {
        href: "/admin/complaints",
        label: "Reclamaciones",
        icon: FileWarning,
        badge: (s) => s.complaints_pendientes,
      },
    ],
  },
  {
    title: "Usuarios",
    items: [{ href: "/admin/users", label: "Usuarios", icon: Users }],
  },
  {
    title: "Contenido",
    items: [
      {
        href: "/admin/posts",
        label: "Artículos",
        icon: FileText,
        badge: (s) => s.posts_draft,
      },
    ],
  },
  {
    title: "Campañas",
    items: [
      { href: "/admin/offers", label: "Ofertas (CPALead)", icon: Megaphone },
      {
        href: "/admin/postbacks",
        label: "Conversiones",
        icon: Target,
        badge: (s) => s.postbacks_pending,
      },
      {
        href: "/admin/postback-logs",
        label: "Logs de postback",
        icon: AlertTriangle,
        badge: (s) => s.postback_logs_unverified_7d,
      },
    ],
  },
  {
    title: "Auditoría",
    items: [{ href: "/admin/logs", label: "Acciones de admin", icon: ScrollText }],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session?.apiToken) return;
    getMe(session.apiToken)
      .then((m) => {
        setMe(m);
        // 表示上のガード。権限判定の正はサーバー側の require_admin
        if (!m.is_admin) setDenied(true);
      })
      .catch(() => setDenied(true));
  }, [session?.apiToken]);

  useEffect(() => {
    if (!session?.apiToken || !me?.is_admin) return;
    getAdminStats(session.apiToken).then(setStats).catch(console.error);
  }, [session?.apiToken, me?.is_admin, pathname]);

  if (denied) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-6 text-center">
        <div>
          <ClipboardList className="mx-auto h-8 w-8 text-neutral-400" />
          <p className="mt-3 text-neutral-900">No tienes permiso para ver esta sección.</p>
          <Link href="/home" className="mt-2 inline-block text-sm text-yellow-600 underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-neutral-100">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto bg-neutral-900 text-neutral-300 md:flex">
        {/* プロフィール要素: 誰として操作しているかを常に見せる */}
        <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-4">
          <Avatar src={me?.avatar_url} name={me?.name} email={me?.email} />
          <div className="min-w-0">
            <div className="truncate text-sm text-white">{me?.name ?? "—"}</div>
            <div className="text-xs text-neutral-500">Administrador</div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3">
          {GROUPS.map((group) => (
            <div key={group.title} className="mb-4">
              <h2 className="px-3 pb-1 text-[0.65rem] uppercase tracking-wide text-neutral-600">
                {group.title}
              </h2>
              {group.items.map(({ href, label, icon: Icon, badge }) => {
                const active = pathname === href;
                const count = stats && badge ? badge(stats) : 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active ? "bg-neutral-800 text-white" : "hover:bg-neutral-800/60 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{label}</span>
                    {count > 0 && (
                      <span className="rounded-full bg-yellow-400 px-1.5 text-xs tabular-nums text-neutral-900">
                        {count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-neutral-800 px-4 py-3">
          <Link href="/home" className="text-xs text-neutral-500 hover:text-white">
            ← Volver a Papunto
          </Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        {/* 狭い画面ではサイドバーを畳み、横スクロールのタブとして出す */}
        <nav className="flex gap-1 overflow-x-auto border-b border-neutral-200 bg-neutral-900 px-2 py-2 md:hidden">
          {GROUPS.flatMap((g) => g.items).map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs ${
                pathname === href ? "bg-neutral-700 text-white" : "text-neutral-400"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
