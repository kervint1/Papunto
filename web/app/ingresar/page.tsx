"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { MagicLinkForm } from "@/components/MagicLinkForm";

// NextAuthが ?error= で返す理由。既定のメッセージは英語で素っ気ないため差し替える
const ERROR_MESSAGES: Record<string, string> = {
  BackendUnavailable: "No pudimos conectar con el servidor. Inténtalo de nuevo en un momento.",
  BackendRejected: "No pudimos verificar tu cuenta. Vuelve a intentarlo.",
  OAuthCallback: "Hubo un problema al volver. Vuelve a intentarlo.",
  // Facebookはメールを返さないことがある（電話番号だけで登録した人など）。
  // 一般的な失敗と同じ文言だと「なぜ入れないのか」が伝わらない
  FacebookNoEmail:
    "Tu cuenta de Facebook no tiene un correo. Entra con Google o con tu correo.",
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
        {/* ⚠️ メールを先に置く。**Facebookのアプリ内ブラウザではGoogleが動かない**
            （403 disallowed_useragent）。集客はFacebookグループなので、
            そこから来た人が最初に見るべきなのはこちら */}
        <MagicLinkForm />

        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <span className="h-px flex-1 bg-neutral-200" />o
          <span className="h-px flex-1 bg-neutral-200" />
        </div>

        {/* Facebookを先に置く。集客がFacebookグループなので、来る人は
            ほぼ全員ログイン済みで、押すだけで終わる */}
        <Button
          variant="outline"
          className="h-12 w-full gap-3 border-neutral-200"
          onClick={() => signIn("facebook", { callbackUrl: "/tareas" })}
        >
          <FacebookIcon />
          Continuar con Facebook
        </Button>

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

function FacebookIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"
      />
    </svg>
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
