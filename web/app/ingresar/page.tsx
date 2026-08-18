"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

// NextAuthが ?error= で返す理由。既定のメッセージは英語で素っ気ないため差し替える
const ERROR_MESSAGES: Record<string, string> = {
  BackendUnavailable: "No pudimos conectar con el servidor. Inténtalo de nuevo en un momento.",
  BackendRejected: "No pudimos verificar tu cuenta de Google. Vuelve a intentarlo.",
  OAuthCallback: "Hubo un problema al volver de Google. Vuelve a intentarlo.",
  SessionExpired: "Tu sesión caducó. Vuelve a iniciar sesión.",
  AccessDenied: "No se pudo acceder con esa cuenta.",
};

function LoginContent() {
  const { status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const error = params.get("error");

  // すでにログイン済みならログイン画面を見せない
  useEffect(() => {
    if (status === "authenticated") router.replace("/tareas");
  }, [status, router]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 pb-10 pt-16">
      <div className="flex flex-col items-center text-center">
        <Logo />
        <h1 className="mt-8">¡Bienvenido! 👋</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Inicia sesión para empezar a ganar puntos
        </p>
      </div>

      {error && (
        <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {ERROR_MESSAGES[error] ?? "No se pudo iniciar sesión. Vuelve a intentarlo."}
        </p>
      )}

      <div className="mt-10 flex flex-col gap-4">
        <Button
          variant="outline"
          className="h-12 w-full gap-3 border-neutral-200"
          onClick={() => signIn("google", { callbackUrl: "/tareas" })}
        >
          <GoogleIcon />
          Continuar con Google
        </Button>
      </div>

      <p className="mt-auto pt-8 text-center text-xs text-neutral-400">
        Al continuar, aceptas los Términos de uso y la Política de privacidad.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full bg-white">
      {/* useSearchParams はSuspense境界が要る */}
      <Suspense fallback={null}>
        <LoginContent />
      </Suspense>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
