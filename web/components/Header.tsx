"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, ChevronRight, ListChecks, Smartphone, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { Logo } from "@/components/Logo";

// アイコン付きのグローバルナビ。主要な貯める・使う導線を常時出しておく
const NAV: { href: string; label: string; icon: LucideIcon; badge?: string }[] = [
  { href: "/home", label: "Tareas", icon: ListChecks, badge: "Empieza aquí" },
  { href: "/cuenta", label: "Mis puntos", icon: Wallet },
  { href: "/exchange", label: "Canjear", icon: ArrowLeftRight },
  { href: "/exchange/recarga", label: "Recarga", icon: Smartphone },
];

export function Header({
  points,
  avatarUrl,
  name,
  email,
}: {
  points: number;
  avatarUrl?: string | null;
  name?: string | null;
  email?: string | null;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white">
      {/* 1段目: ロゴ / アカウント / メニュー */}
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/home" aria-label="Inicio">
          <Logo />
        </Link>

        <div className="flex items-center gap-2">
          {/* 所持ポイントをいちばん目立たせ、そこからアカウント画面に入る導線にする */}
          <Link
            href="/cuenta"
            aria-current={pathname === "/cuenta" ? "page" : undefined}
            className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-1.5 transition-colors ${
              pathname === "/cuenta" ? "bg-neutral-100" : "hover:bg-neutral-100"
            }`}
          >
            <Avatar src={avatarUrl} name={name} email={email} />
            <span className="flex flex-col leading-tight">
              <span className="hidden max-w-[8rem] truncate text-[0.7rem] text-neutral-500 sm:block">
                {name ?? "Mi cuenta"}
              </span>
              <span className="tabular-nums text-sm text-yellow-600">
                {points.toLocaleString("es-PE")} pts
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </Link>

          <HamburgerMenu points={points} name={name} />
        </div>
      </div>

      {/* 2段目: グローバルナビ。狭い画面では横スクロールさせる */}
      <nav className="border-t border-neutral-100">
        <div className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-2 sm:px-4">
          {NAV.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex shrink-0 flex-col items-center gap-0.5 px-4 py-2 text-xs transition-colors ${
                  active
                    ? "text-neutral-900 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-yellow-400"
                    : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {badge && (
                  <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-yellow-400 px-1.5 text-[0.6rem] leading-4 text-neutral-900">
                    {badge}
                  </span>
                )}
                <Icon className="mt-2 h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
