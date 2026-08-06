"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Smartphone } from "lucide-react";

import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMe } from "@/hooks/useMe";
import {
  ApiError,
  createTopUp,
  detectOperator,
  type OperatorDetectResult,
} from "@/lib/api";

export default function RecargaCelularPage() {
  const router = useRouter();
  const { me, token, refresh } = useMe();

  const [phone, setPhone] = useState("");
  const [operator, setOperator] = useState<OperatorDetectResult | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  const [pointsInput, setPointsInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const points = me?.points ?? 0;
  const minPoints = me?.min_withdrawal_points ?? 500;
  const rate = me?.points_per_sol ?? 100;
  const inputPoints = Number(pointsInput) || 0;
  const solesPreview = inputPoints > 0 ? inputPoints / rate : 0;
  const phoneValid = /^\d{9}$/.test(phone);
  const canWithdraw = points >= minPoints;
  const canSubmit =
    !!token &&
    !submitting &&
    canWithdraw &&
    phoneValid &&
    operator !== null &&
    inputPoints > 0;

  // 電話番号が9桁になったら少し待ってから自動でキャリアを判定する
  useEffect(() => {
    setOperator(null);
    setDetectError(null);
    if (!phoneValid || !token) return;

    const timeout = setTimeout(async () => {
      setDetecting(true);
      try {
        const result = await detectOperator(token, phone);
        setOperator(result);
      } catch (err) {
        setDetectError(
          err instanceof ApiError ? err.message : "No se pudo identificar el operador"
        );
      } finally {
        setDetecting(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, phoneValid, token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !operator) return;
    setError(null);
    setSubmitting(true);
    try {
      await createTopUp(token, phone, operator.operator_id, inputPoints);
      await refresh();
      router.push("/cuenta");
    } catch (err) {
      if (err instanceof ApiError && err.code === "OPERATOR_MISMATCH") {
        // 番号のキャリアが変わっていた場合: 再検出させて確認を促す
        setOperator(null);
        setError("El operador cambió, verifica el número nuevamente.");
      } else {
        setError(err instanceof ApiError ? err.message : "Error inesperado");
      }
      setSubmitting(false);
    }
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
            <Smartphone className="h-8 w-8 text-neutral-700" />
          </div>
          <div>
            <h1>Recarga celular</h1>
            <p className="text-sm text-neutral-500">Claro, Movistar, Entel o Bitel</p>
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
            <p className="text-xs text-neutral-500">Tiempo de procesamiento</p>
            <p className="mt-1 text-neutral-900">Instantáneo</p>
          </div>
        </div>

        {/* Form */}
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3>Datos de la recarga</h3>
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Número de celular (9 dígitos)</Label>
              <Input
                id="phone"
                inputMode="numeric"
                maxLength={9}
                placeholder="9XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              />
              {phone.length > 0 && !phoneValid && (
                <p className="text-xs text-destructive">
                  Ingresa un número de 9 dígitos.
                </p>
              )}
              {detecting && (
                <p className="text-xs text-neutral-500">Identificando operador...</p>
              )}
              {operator && (
                <p className="flex items-center gap-1 text-xs text-green-700">
                  <Check className="h-3.5 w-3.5" />
                  Operador detectado: <strong>{operator.operator_name}</strong>
                </p>
              )}
              {detectError && (
                <p className="text-xs text-destructive">{detectError}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="points">
                Puntos a canjear (mínimo {minPoints.toLocaleString("es-PE")})
              </Label>
              <Input
                id="points"
                inputMode="numeric"
                disabled={!operator}
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
                  de recarga
                </p>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              disabled={!canSubmit}
              className="h-12 w-full bg-yellow-400 text-neutral-900 hover:bg-yellow-300 disabled:bg-neutral-200 disabled:text-neutral-400"
            >
              {submitting ? "Enviando..." : "Solicitar recarga"}
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
