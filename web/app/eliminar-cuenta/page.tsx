"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

import { DeleteAccountCard } from "@/components/DeleteAccountCard";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

/**
 * 退会のための公開ページ。
 *
 * ⚠️ **Google Play の要件で、アプリを入れ直さずに削除を要求できるURLが要る。**
 *    このURLを Play Console の Data safety フォームに登録するので、
 *    **パスを変えないこと**（変えるとフォームの申告と食い違う）。
 *
 * ⚠️ ログイン前でも「何が消えるか」が読めるようにしておく。ログインを
 *    強制してから説明すると、要件の「削除を要求できる」を満たしにくい。
 */
export default function EliminarCuentaPage() {
  const { status } = useSession();

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <Link href="/" className="inline-block">
        <Logo />
      </Link>

      <h1 className="mt-8 text-xl text-neutral-900">Eliminar tu cuenta de Papunto</h1>

      <p className="mt-3 text-sm leading-relaxed text-neutral-700">
        Puedes eliminar tu cuenta cuando quieras, desde aquí o desde la
        aplicación. No hace falta escribirnos.
      </p>

      <h2 className="mt-8 text-sm font-semibold text-neutral-900">Qué se elimina</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
        <li>Tu correo electrónico</li>
        <li>Tu nombre y tu foto</li>
        <li>Tu número de celular</li>
        <li>Los puntos que tengas sin canjear</li>
      </ul>

      <h2 className="mt-6 text-sm font-semibold text-neutral-900">Qué se conserva</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-700">
        Guardamos el registro contable de los pagos que ya te hicimos, sin los
        datos que te identifican. Es una obligación legal y no permite
        reconstruir tu identidad.
      </p>

      <div className="mt-8">
        {status === "authenticated" ? (
          <DeleteAccountCard />
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-center shadow-sm">
            <p className="text-sm text-neutral-700">
              Inicia sesión con la cuenta que quieres eliminar.
            </p>
            <Button asChild className="mt-4 h-12 w-full bg-neutral-900 text-white">
              <Link href="/ingresar?callbackUrl=/eliminar-cuenta">Iniciar sesión</Link>
            </Button>
          </div>
        )}
      </div>

      <p className="mt-8 text-xs text-neutral-500">
        ¿Tienes dudas? Escríbenos a{" "}
        <a href="mailto:soporte@papunto.pe" className="underline">
          soporte@papunto.pe
        </a>
        . Consulta también nuestra{" "}
        <Link href="/privacidad" className="underline">
          política de privacidad
        </Link>
        .
      </p>
    </main>
  );
}
