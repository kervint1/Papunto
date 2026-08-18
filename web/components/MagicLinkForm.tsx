"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

import { ApiError, requestMagicLink } from "@/lib/api";
import { Button } from "@/components/ui/button";

/**
 * メールでログインする入口。
 *
 * ⚠️ **これがFacebookのアプリ内ブラウザで動く唯一の手段**。Googleは
 *    埋め込みWebViewでのOAuthを拒否するため（403 disallowed_useragent）、
 *    グループのリンクから来た人はGoogleログインを押せない。
 *    目立たない場所に隠さないこと。
 */
const MESSAGES: Record<string, string> = {
  TOO_MANY_REQUESTS: "Espera unos minutos antes de pedir otro enlace.",
  MAIL_FAILED: "No pudimos enviar el correo. Inténtalo de nuevo.",
  MAIL_UNAVAILABLE: "El inicio con correo no está disponible ahora.",
};

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await requestMagicLink(email.trim());
      setSent(true);
    } catch (e) {
      setError(
        e instanceof ApiError ? MESSAGES[e.code] ?? e.message : "Error de conexión"
      );
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl bg-neutral-50 p-5 text-center text-sm">
        <p className="text-neutral-900">Revisa tu correo</p>
        <p className="mt-1 text-neutral-600">
          Te enviamos un enlace a <strong>{email}</strong>. Vence en 15 minutos.
        </p>
        <button
          onClick={() => setSent(false)}
          className="mt-3 text-xs text-neutral-500 underline underline-offset-2"
        >
          Usar otro correo
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="tucorreo@ejemplo.com"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 w-full rounded-xl border border-neutral-200 px-4 text-neutral-900"
        />
        <Button
          onClick={submit}
          disabled={busy || !email.trim()}
          className="h-12 shrink-0 gap-2 bg-neutral-900 px-6 text-white"
        >
          <Mail className="h-4 w-4" />
          {busy ? "Enviando..." : "Enviar enlace"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
