"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

import { type ReferralMe } from "@/lib/api";

/**
 * 招待の共有。ホームに置く。
 *
 * ⚠️ 「あなたを招待したのは誰か」をここに出さないこと。このカードは
 *    「招待すると200pt もらえる」と書いてあるので、隣に置くと
 *    「呼んだ人は200pt もらったのに自分は何も無い」と読める。
 *    登録直後に最初に伝える情報ではない。招待元の表示は CampaignCard 側。
 *
 * ペルーはWhatsApp中心なので、**共有導線をWhatsAppに寄せる**。
 * 汎用の共有シートより、押した先が想像できる方が踏まれる。
 * `navigator.share` が使える端末ではそちらを優先する（アプリ選択が出る）。
 */
export function InviteCard({ data }: { data: ReferralMe | null }) {
  const [copied, setCopied] = useState(false);

  if (!data) return null;

  // リンクとコードの両方を載せる。WhatsAppのアプリ内ブラウザではリンク経由の
  // 紐づけが失われることがあるので、コードを手で打てる形で必ず添える
  const message =
    `Te invito a Papunto: completa tareas y recibe tu dinero por Yape.\n\n` +
    `${data.share_url}\n\n` +
    `Si el enlace no funciona, regístrate y escribe mi código: ${data.code}`;

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        // ユーザーが閉じただけ。WhatsAppへのフォールバックはしない
        return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードが使えない端末では、下のリンクを手で選べる
    }
  };

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8">
      <p className="text-sm text-neutral-500">Campaña de invitación</p>
      <div className="mt-1 text-neutral-900" style={{ fontSize: "1.75rem", lineHeight: 1.2 }}>
        Gana {data.reward_points} pts por cada amigo
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        {/* 成立の条件は時期で変わる。何をすれば報酬が出るかを正確に書く */}
        {data.settles_on_registration
          ? "Recibes los puntos apenas tu amigo crea su cuenta."
          : "Recibes los puntos cuando tu amigo registra su número de Yape."}
      </p>
      {/* 期間限定だと明示しておく。後で金額を下げるのが
          「キャンペーン終了」として自然に通るようにするため */}
      <p className="mt-1 text-xs text-neutral-400">
        Monto de campaña · puede cambiar más adelante.{" "}
        <a href="/campana" className="underline underline-offset-2">
          Ver bases
        </a>
      </p>

      <div className="mt-5 rounded-2xl bg-neutral-50 p-4">
        <p className="text-xs text-neutral-500">Tu código</p>
        {/* コードを主役にする。リンクはアプリ内ブラウザで紐づけが切れることが
            あるが、コードは手で打てるので確実に届く */}
        <p className="mt-0.5 font-mono text-2xl tracking-widest text-neutral-900">
          {data.code}
        </p>
        <p className="mt-2 break-all text-xs text-neutral-500">{data.share_url}</p>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={share}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-6 text-sm text-white hover:bg-neutral-800"
        >
          <Share2 className="h-4 w-4" />
          Compartir por WhatsApp
        </button>
        <button
          onClick={copy}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-neutral-300 px-6 text-sm text-neutral-900 hover:bg-neutral-50"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copiado" : "Copiar enlace"}
        </button>
      </div>

      {data.total > 0 && (
        <div className="mt-5 flex gap-6 border-t border-neutral-100 pt-4 text-sm">
          <div>
            <p className="text-xs text-neutral-500">Invitados</p>
            <p className="mt-0.5 text-neutral-900">{data.total}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Confirmados</p>
            <p className="mt-0.5 text-neutral-900">{data.settled}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Ganado</p>
            <p className="mt-0.5 text-neutral-900">
              {data.earned_points.toLocaleString("es-PE")} pts
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
