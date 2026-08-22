"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Trash2 } from "lucide-react";

import { ApiError, deleteAccount } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/useMe";

const MESSAGES: Record<string, string> = {
  // 申請時点でポイントを引いてあるので、消すと送るべき額の記録が宙に浮く
  WITHDRAWAL_PENDING:
    "Tienes un canje en proceso. Espera a que se complete antes de eliminar tu cuenta.",
  ALREADY_DELETED: "Esta cuenta ya fue eliminada.",
};

/**
 * 退会。
 *
 * ⚠️ **Google Play はアカウントを作れるアプリに削除手段を義務づけている**
 *    （2024年4月15日から完全施行）。アプリ内の導線と、アプリを入れ直さずに
 *    要求できるWebのURLの両方が要る。このカードは両方から使う。
 */
export function DeleteAccountCard() {
  const { me, token } = useMe();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(token);
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      setError(
        e instanceof ApiError ? MESSAGES[e.code] ?? e.message : "Error de conexión"
      );
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-neutral-900">Eliminar mi cuenta</h2>

      <p className="mt-2 text-sm text-neutral-600">
        Se borran tu correo, tu nombre y tu número de celular. No podrás
        recuperar la cuenta.
      </p>

      {/* 一番怒られるのはここなので、押す前に必ず見せる */}
      <div className="mt-3 rounded-xl bg-yellow-50 p-3 text-sm text-neutral-700">
        <strong className="font-semibold text-neutral-900">
          Pierdes los puntos que tengas.
        </strong>{" "}
        Si te quedan puntos, cámbialos antes de eliminar la cuenta.
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        Por obligación legal y contable guardamos el registro de los pagos que
        ya te hicimos, sin los datos que te identifican.
      </p>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm text-red-600 transition-colors hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          Eliminar mi cuenta
        </button>
      ) : (
        <div className="mt-4 rounded-xl bg-neutral-50 p-4">
          <p className="text-sm text-neutral-900">
            ¿Seguro que quieres eliminar la cuenta de{" "}
            <strong>{me?.email}</strong>?
          </p>
          {me && me.points > 0 && (
            <p className="mt-1 text-sm text-red-600">
              Perderás {me.points.toLocaleString("es-PE")} puntos.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={busy}
              className="flex-1 bg-red-600 text-white hover:bg-red-700"
            >
              {busy ? "Eliminando..." : "Sí, eliminar"}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
