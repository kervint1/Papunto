"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";

import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMe } from "@/hooks/useMe";
import { PhoneGate } from "@/components/PhoneGate";
import { ApiError, createWithdrawal } from "@/lib/api";
import { getDestination } from "@/lib/exchangeDestinations";

export default function ExchangeDestinationPage() {
  const { destination: destinationId } = useParams<{ destination: string }>();
  const destination = getDestination(destinationId);
  const router = useRouter();
  const { me, token, refresh } = useMe();

  const [phone, setPhone] = useState("");
  const [pointsInput, setPointsInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const points = me?.points ?? 0;
  const minPoints = me?.min_withdrawal_points ?? 500;
  const rate = me?.points_per_sol ?? 100;
  const inputPoints = Number(pointsInput) || 0;
  const solesPreview = inputPoints > 0 ? inputPoints / rate : 0;
  const canWithdraw = points >= minPoints;
  // 電話番号が未登録なら送信させない（サーバー側も PHONE_REQUIRED で弾く）
  const canSubmit = !!token && !submitting && canWithdraw && !!phone && inputPoints > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      await createWithdrawal(token, inputPoints);
      await refresh();
      router.push("/cuenta");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error inesperado");
      setSubmitting(false);
    }
  }

  if (!destination || !destination.available) {
    return (
      <div className="min-h-screen w-full bg-neutral-50">
        <Header points={points} avatarUrl={me?.avatar_url} name={me?.name} email={me?.email} />
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <Link
            href="/exchange"
            className="flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <p className="mt-6 text-neutral-500">
            Este destino no está disponible todavía.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-neutral-50">
      <Header points={points} avatarUrl={me?.avatar_url} name={me?.name} email={me?.email} />

      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/exchange"
          className="flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>

        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-yellow-100 p-2">
            {typeof destination.icon === "string" ? (
              <Image
                src={destination.icon}
                alt={destination.name}
                width={56}
                height={56}
                className="h-full w-full object-contain"
              />
            ) : (
              <destination.icon className="h-8 w-8 text-neutral-700" />
            )}
          </div>
          <div>
            <h1>Canjear a {destination.name}</h1>
            <p className="text-sm text-neutral-500">{destination.desc}</p>
          </div>
        </div>

        {/* Details */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500">Tasa de cambio</p>
            <p className="mt-1 text-neutral-900">
              {rate.toLocaleString("es-PE")} pts = S/ 1.00
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500">Mínimo para canjear</p>
            <p className="mt-1 text-neutral-900">
              {minPoints.toLocaleString("es-PE")} pts
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="flex items-center gap-1 text-xs text-neutral-500">
              <Clock className="h-3.5 w-3.5" />
              Tiempo de procesamiento
            </p>
            <p className="mt-1 text-neutral-900">{destination.processingTime}</p>
          </div>
        </div>

        {/* Form */}
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3>Datos del canje</h3>
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            {/* 送金先は登録済みの番号を使う。申請ごとの自由入力だと
                登録と送金先がずれ、一意制約を回避できてしまう */}
            <PhoneGate token={token} onRegistered={setPhone} />

            <div className="flex flex-col gap-2">
              <Label htmlFor="points">
                Puntos a canjear (mínimo {minPoints.toLocaleString("es-PE")})
              </Label>
              <Input
                id="points"
                inputMode="numeric"
                placeholder={minPoints.toLocaleString("es-PE")}
                value={pointsInput}
                onChange={(e) =>
                  setPointsInput(e.target.value.replace(/\D/g, ""))
                }
              />
              {inputPoints > 0 && (
                <p className="text-sm text-neutral-600">
                  Recibirás{" "}
                  <span className="font-medium">
                    S/ {solesPreview.toFixed(2)}
                  </span>{" "}
                  en tu Yape
                </p>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              disabled={!canSubmit}
              className="h-12 w-full bg-yellow-400 text-neutral-900 hover:bg-yellow-300 disabled:bg-neutral-200 disabled:text-neutral-400"
            >
              {submitting ? "Enviando..." : "Solicitar canje"}
            </Button>
            {!canWithdraw && (
              <p className="text-center text-xs text-neutral-500">
                Te faltan {(minPoints - points).toLocaleString("es-PE")} pts
                para solicitar
              </p>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
