import Link from "next/link";

import { Logo } from "@/components/Logo";

/**
 * 法務ページの共通レイアウト。
 *
 * 体裁は実際の企業の規約ページ（Rappi Perú 等）に合わせている。
 *
 * **カード・枠線・影を使わない。** 白地に文字を置き、見出しは小さい大文字、
 * 本文は小さめで行間を広く、横幅を狭く取る。囲みを重ねると
 * 「テンプレートを埋めただけ」に見え、規約としての信用を損なう。
 */
const RELATED = [
  { label: "Bases de la campaña", href: "/campana" },
  { label: "Términos de Uso", href: "/terminos" },
  { label: "Política de Privacidad", href: "/privacidad" },
  { label: "Política de Cookies", href: "/cookies" },
  { label: "Consentimiento de Cookies", href: "/consentimiento-cookies" },
  { label: "Libro de Reclamaciones", href: "/reclamaciones" },
];

/** 節の見出し。番号も枠も付けない */
export function LegalHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 text-[0.8125rem] font-semibold uppercase tracking-wide text-neutral-900">
      {children}
    </h2>
  );
}

export function LegalLayout({
  title,
  updated,
  current,
  children,
}: {
  title: string;
  /** 「Última actualización」に出す日付 */
  updated: string;
  /** 現在のページのパス。一覧で色を変えるのに使う */
  current: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-white">
      <header className="border-b border-neutral-100">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Logo />
          </Link>
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">
            Ir a Papunto
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-6 py-12 lg:grid-cols-[minmax(0,34rem)_1fr]">
        <main>
          <p className="text-sm text-neutral-500">Papunto</p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">{title}</h1>
          <p className="mt-2 text-xs text-neutral-500">
            Última actualización: {updated}
          </p>

          <div className="mt-8 text-sm leading-relaxed text-neutral-700">
            {children}
          </div>
        </main>

        <nav className="lg:pt-16">
          <ul className="space-y-2 text-sm">
            {RELATED.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={
                    href === current
                      ? "text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-900"
                  }
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
