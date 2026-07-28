"use client";

import Image from "next/image";
import Link from "next/link";

import { Header } from "@/components/Header";
import { useMe } from "@/hooks/useMe";
import { DESTINATIONS } from "@/lib/exchangeDestinations";

export default function ExchangePage() {
  const { me } = useMe();
  const points = me?.points ?? 0;

  return (
    <div className="min-h-screen w-full bg-neutral-50">
      <Header points={points} />

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <h1>Canjear puntos</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Elige a dónde quieres recibir tu dinero
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:max-w-md">
          {DESTINATIONS.map((d) => {
            const card = (
              <div
                className={`flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm transition-colors ${
                  d.available
                    ? "border-neutral-200 hover:border-yellow-300"
                    : "cursor-not-allowed border-neutral-200 opacity-50"
                }`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-yellow-100 p-1.5">
                  {typeof d.icon === "string" ? (
                    <Image
                      src={d.icon}
                      alt={d.name}
                      width={48}
                      height={48}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <d.icon className="h-7 w-7 text-neutral-700" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-neutral-900">{d.name}</div>
                  <p className="text-sm text-neutral-500">{d.desc}</p>
                </div>
              </div>
            );

            return d.available ? (
              <Link key={d.id} href={`/exchange/${d.id}`}>
                {card}
              </Link>
            ) : (
              <div key={d.id}>{card}</div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
