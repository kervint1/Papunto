"use client";

import { useEffect, useState } from "react";
import { Check, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, getPhone, registerPhone } from "@/lib/api";

/**
 * 電話番号の登録／表示。
 *
 * ログイン時には求めず、タスクの実行と換金の手前で初めて求める。
 * 先に電話番号を要求すると詐欺だと思われて離脱するため。
 *
 * 一度登録したら変更できない（1つの番号を複数アカウントで使い回せてしまう）。
 * その旨を登録前に明示する。
 */
export function PhoneGate({
  token,
  onRegistered,
}: {
  token: string | undefined;
  /** 登録済みになったら親に伝える（送信ボタンの有効化に使う） */
  onRegistered: (phone: string) => void;
}) {
  const [registered, setRegistered] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    getPhone(token)
      .then((s) => {
        if (s.phone) {
          setRegistered(s.phone);
          onRegistered(s.phone);
        }
      })
      .catch(() => setError("No se pudo cargar tu número"))
      .finally(() => setLoading(false));
    // onRegistered は親で再生成されうるので依存に入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const valid = /^9\d{8}$/.test(input);

  async function save() {
    if (!token || !valid) return;
    setError(null);
    setSaving(true);
    try {
      const s = await registerPhone(token, input);
      if (s.phone) {
        setRegistered(s.phone);
        onRegistered(s.phone);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Cargando...</p>;
  }

  if (registered) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <p className="text-xs text-neutral-500">Número de Yape registrado</p>
        <p className="mt-1 flex items-center gap-2 text-neutral-900">
          <Check className="h-4 w-4 text-green-600" />
          <span className="font-medium">{registered}</span>
        </p>
        <p className="mt-2 text-xs text-neutral-400">
          Escríbenos si necesitas cambiarlo.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-yellow-300 bg-yellow-50 p-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-neutral-700" />
        <h3 className="text-neutral-900">Registra tu número de Yape</h3>
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        Es donde recibirás tu dinero. Solo lo pedimos ahora, no al crear tu cuenta.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <Label htmlFor="yape-phone">Número (9 dígitos, empieza con 9)</Label>
        <Input
          id="yape-phone"
          inputMode="numeric"
          maxLength={9}
          placeholder="9XXXXXXXX"
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
        />
        {input.length > 0 && !valid && (
          <p className="text-xs text-destructive">
            Debe tener 9 dígitos y empezar con 9.
          </p>
        )}
        {/* 変更できないことを登録前に伝える */}
        <p className="text-xs text-neutral-500">
          Revísalo bien: no podrás cambiarlo después.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="button"
          disabled={!valid || saving}
          onClick={save}
          className="mt-1 h-11 bg-neutral-900 text-white hover:bg-neutral-800"
        >
          {saving ? "Guardando..." : "Registrar número"}
        </Button>
      </div>
    </div>
  );
}
