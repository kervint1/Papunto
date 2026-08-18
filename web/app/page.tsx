"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowRight, Banknote, ListChecks, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CampaignBadge } from "@/components/CampaignBadge";
import { Logo } from "@/components/Logo";
import { InviteIntro } from "@/components/InviteIntro";
import { captureRefFromUrl } from "@/lib/referral";

const STEPS = [
  { icon: ListChecks, title: "Elige una tarea", desc: "Solo elige la que más te guste" },
  { icon: Target, title: "Cumple la condición", desc: "Completa un paso sencillo" },
  { icon: Banknote, title: "Recibe con Yape", desc: "Cobra tus puntos al instante" },
];

export default function LandingPage() {
  const router = useRouter();
  const { status } = useSession();

  // 招待リンク（?ref=）で来た場合にコードを保存する。ログインの往復を挟むので、
  // 適用はログイン後に ReferralClaimer が行う
  useEffect(() => {
    captureRefFromUrl();
  }, []);

  // ログイン済みならLPを見せずにHomeへ送る。
  // ルートに戻るたびログインを求められるように見えるのを防ぐ
  useEffect(() => {
    if (status === "authenticated") router.replace("/tareas");
  }, [status, router]);

  const goLogin = () => router.push(status === "authenticated" ? "/tareas" : "/ingresar");

  return (
    <div
      className="min-h-screen w-full cursor-pointer select-none bg-white"
      onClick={goLogin}
      role="button"
      aria-label="Ir a iniciar sesión"
    >
      {/* Hero */}
      <div className="bg-yellow-400">
        <div className="mx-auto w-full max-w-5xl px-6 pb-12 pt-6 sm:px-8">
          <Logo />
          {/* 1カラム。埋めるためだけの図版を置かない */}
          <div className="mt-10 max-w-2xl">
            {/* 事前登録の残り枠。希少性が登録の動機になるので最初に見せる。
              取得に失敗したら何も出ない（LP自体は成立する） */}
            <CampaignBadge />
            <p className="mt-2 inline-block rounded-full bg-white/40 px-3 py-1 text-sm text-neutral-800">
              🇵🇪 Solo en Perú
            </p>
            <h1
              className="mt-4 text-neutral-900"
              style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)", lineHeight: 1.25 }}
            >
              Completa tareas y
              <br />
              recibe <span className="text-white">puntos por Yape</span>
            </h1>
            <p className="mt-3 max-w-xl text-neutral-800">
              Gana puntos completando tareas sencillas como encuestas o
              registros, y cámbialos por dinero en tu billetera Yape.
            </p>
            <p className="mt-3 max-w-xl rounded-2xl bg-white/50 px-4 py-3 text-sm text-neutral-800">
              <strong>Todavía estamos preparando el lanzamiento.</strong> Las
              tareas para ganar puntos aún no están disponibles. Mientras
              tanto, puedes leer nuestras guías para ahorrar y ganar dinero en
              Perú.
            </p>

            {/* 登録の前に招待コードを確かめられるようにする。
                後から入れる形だと、入ったかどうか分からないまま登録させることになる */}
            <InviteIntro />

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {/* ブログは公開済みで読める。準備中の間はそちらへ送る */}
              <Button
                asChild
                size="lg"
                className="h-12 bg-neutral-900 px-8 text-white hover:bg-neutral-800"
              >
                <a href="/blog" onClick={(e) => e.stopPropagation()}>
                  Leer las guías
                  <ArrowRight className="ml-1 h-4 w-4" />
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-neutral-900 bg-transparent px-8 text-neutral-900 hover:bg-white/40"
              >
                Crear mi cuenta
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 3 steps */}
      <div className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-8">
        <h2 className="text-center">Así de fácil: 3 pasos</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="flex items-center gap-4 rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm sm:flex-col sm:items-start sm:p-6"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600">
                <s.icon className="h-6 w-6" />
              </div>
              <div>
                <span className="text-sm text-yellow-500">PASO {i + 1}</span>
                <div className="text-neutral-900">{s.title}</div>
                <p className="text-sm text-neutral-500">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl bg-neutral-900 p-8 text-center text-white">
          <p className="text-sm text-neutral-300">Así funcionará Papunto</p>
          <p style={{ fontSize: "1.5rem" }} className="mt-1">
            cuando lancemos
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm text-neutral-300">
            Aún no puedes ganar puntos. Estamos preparando el catálogo de tareas
            para Perú.
          </p>
          <Button
            asChild
            className="mx-auto mt-4 h-11 w-full max-w-sm bg-yellow-400 text-neutral-900 hover:bg-yellow-300"
          >
            <a href="/blog" onClick={(e) => e.stopPropagation()}>
              Leer las guías mientras tanto
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
