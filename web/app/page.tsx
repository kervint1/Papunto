"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowRight, Banknote, ListChecks, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const STEPS = [
  { icon: ListChecks, title: "Elige una tarea", desc: "Solo elige la que más te guste" },
  { icon: Target, title: "Cumple la condición", desc: "Completa un paso sencillo" },
  { icon: Banknote, title: "Recibe con Yape", desc: "Cobra tus puntos al instante" },
];

export default function LandingPage() {
  const router = useRouter();
  const { status } = useSession();

  // ログイン済みならLPを見せずにHomeへ送る。
  // ルートに戻るたびログインを求められるように見えるのを防ぐ
  useEffect(() => {
    if (status === "authenticated") router.replace("/home");
  }, [status, router]);

  const goLogin = () => router.push(status === "authenticated" ? "/home" : "/login");

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
          <div className="mt-10 grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="inline-block rounded-full bg-white/40 px-3 py-1 text-sm text-neutral-800">
                🇵🇪 Solo en Perú · Empieza gratis
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
                Gana puntos al instante completando tareas sencillas como
                encuestas o registros. Cámbialos por dinero directo en tu
                billetera Yape.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="h-12 bg-neutral-900 px-8 text-white hover:bg-neutral-800"
                >
                  Empezar gratis
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 border-neutral-900 bg-transparent px-8 text-neutral-900 hover:bg-white/40"
                >
                  Cobrar con Yape
                </Button>
              </div>
            </div>

            {/* Hero visual */}
            <div className="hidden justify-center lg:flex">
              <div className="rounded-3xl bg-white/50 p-8 text-center shadow-sm">
                <span style={{ fontSize: "5rem", lineHeight: 1 }}>💸</span>
                <p className="mt-4 text-neutral-800">
                  Tareas simples,
                  <br />
                  recompensas al toque
                </p>
              </div>
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
          <p className="text-sm text-neutral-300">Empieza ahora y</p>
          <p style={{ fontSize: "1.5rem" }} className="mt-1">
            gana puntos al toque 💸
          </p>
          <Button className="mx-auto mt-4 h-11 w-full max-w-sm bg-yellow-400 text-neutral-900 hover:bg-yellow-300">
            Empezar gratis
          </Button>
        </div>
      </div>
    </div>
  );
}
