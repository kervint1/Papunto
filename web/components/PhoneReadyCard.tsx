"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { PhoneGate } from "@/components/PhoneGate";
import { getPhone } from "@/lib/api";

/**
 * 交換の準備として、電話番号を先に登録できるようにする。
 *
 * ⚠️ **任意**。登録しなくても本人の300ptは入るし、10/1に登録しても間に合う。
 *    「先に電話番号を求めると詐欺と思われて離脱する」という判断は変えていない。
 *    ここは求めるのではなく、準備として案内するだけ。
 *
 * 置いている理由は2つ。
 * 1. 10/1に全員が一斉に登録すると、そこで詰まる。前倒しできる人はしておく方がいい
 * 2. **招待の成立条件が「招待された人の電話番号登録」**なので、経路が無いと
 *    誰も成立しない。招待した側が友達に案内できる先が要る
 */
export function PhoneReadyCard({ token }: { token: string | undefined }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    getPhone(token)
      .then((s) => setPhone(s.phone ?? null))
      .catch(() => setPhone(null))
      .finally(() => setLoaded(true));
  }, [token]);

  if (!loaded) return null;

  if (phone) {
    return (
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8">
        <p className="inline-flex items-center gap-2 text-sm text-neutral-600">
          <Check className="h-4 w-4 text-green-600" />
          Tu número de Yape está registrado
        </p>
        <p className="mt-1 font-mono text-lg tracking-wider text-neutral-900">{phone}</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8">
      <p className="text-sm text-neutral-500">Prepárate para el canje</p>
      <div className="mt-1 text-neutral-900" style={{ fontSize: "1.5rem", lineHeight: 1.25 }}>
        Registra tu número de Yape
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        No es obligatorio ahora. Puedes hacerlo cuando vayas a cobrar, pero si lo
        dejas listo evitas la espera.
      </p>

      {open ? (
        <div className="mt-4">
          <PhoneGate token={token} onRegistered={setPhone} />
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-4 h-11 rounded-xl border border-neutral-300 px-6 text-sm text-neutral-900 hover:bg-neutral-50"
        >
          Registrar mi número
        </button>
      )}
    </div>
  );
}
