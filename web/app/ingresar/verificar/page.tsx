"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

import { Logo } from "@/components/Logo";

/**
 * メールのリンクを踏んだ先。
 *
 * トークンを NextAuth の credentials プロバイダに渡し、セッションに変える。
 * 検証そのものはFastAPI側で行う。
 */
function VerifyContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    const token = params.get("token");
    if (!token || done.current) {
      if (!token) setFailed(true);
      return;
    }
    done.current = true;

    signIn("magic-link", { token, redirect: false }).then((res) => {
      if (res?.ok) router.replace("/tareas");
      else setFailed(true);
    });
  }, [params, router]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo />
      {failed ? (
        <>
          <p className="mt-8 text-neutral-900">El enlace no es válido o ya venció</p>
          <p className="mt-2 text-sm text-neutral-500">
            Los enlaces vencen en 15 minutos y solo se pueden usar una vez.
          </p>
          <a
            href="/ingresar"
            className="mt-6 text-sm text-neutral-900 underline underline-offset-2"
          >
            Pedir un enlace nuevo
          </a>
        </>
      ) : (
        <p className="mt-8 text-sm text-neutral-500">Entrando...</p>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen w-full bg-white">
      <Suspense fallback={null}>
        <VerifyContent />
      </Suspense>
    </div>
  );
}
