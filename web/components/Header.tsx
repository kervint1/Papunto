"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, ChevronRight } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { Logo } from "@/components/Logo";

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
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/home" aria-label="Inicio">
          <Logo />
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="/home"
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              pathname === "/home"
                ? "bg-yellow-100 text-yellow-700"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            Tareas
          </Link>
          <Link
            href="/exchange"
            aria-label="Canjear"
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
              pathname === "/exchange"
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span className="hidden sm:inline">Canjear</span>
          </Link>

          {/* アカウントへの入口。所持ポイントをいちばん目立たせ、そこから /cuenta に入る導線にする */}
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
        </nav>
      </div>
    </header>
  );
}
