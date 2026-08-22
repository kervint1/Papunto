"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowRight, Banknote, ListChecks, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CampaignBadge } from "@/components/CampaignBadge";
import { Logo } from "@/components/Logo";
import { InviteIntro } from "@/components/InviteIntro";
import { captureRefFromUrl } from "@/lib/referral";
import { getCampaignStatus } from "@/lib/api";

/**
 * LPに出す数字の既定値。
 *
 * ⚠️ 固定文字にしないこと。管理画面で報酬や枠の期限を変えたときに、LPだけ
 *    古い数字が残る。ペルーはINDECOPIの消費者保護が効いており、告知と実装の
 *    不一致はそのまま不当表示になる（/campana と同じ理由）。
 *    APIが落ちているときだけこの値で描く。models/campaign_setting.py と揃える。
 */
const FALLBACK = {
  initial: 300,
  bonus: 200,
  opensAt: "2026-10-01",
  reservationDays: 7,
  referral: 200,
};

function soles(points: number) {
  return (points / 100).toFixed(2);
}

function longDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/**
 * ⚠️ 将来の話ではなく、**登録した人に実際に起きること**を順番に書く。
 *    以前は「タスクを選ぶ→条件を満たす→Yapeで受け取る」だったが、
 *    タスクは10/1まで存在しないので、来た人には何も伝わらなかった。
 *
 * ⚠️ **「登録したら300pt」と書かない。** 付与は電話番号の登録時。
 *    「登録するだけでお金」はペルーで詐欺の典型句で、それを避けるために
 *    付与のタイミングを分けてある。文言が元に戻ると設計の意味が消える。
 */
function steps(t: typeof FALLBACK) {
  return [
    {
      icon: ListChecks,
      title: "Crea tu cuenta",
      desc: `Reservamos tu cupo por ${t.reservationDays} días`,
    },
    {
      icon: Target,
      title: "Registra tu número de Yape",
      desc: `Te acreditamos ${t.initial} pts (S/ ${soles(t.initial)}) al instante`,
    },
    {
      icon: Banknote,
      title: `El ${longDate(t.opensAt)}`,
      desc: `Abrimos las tareas. Con 1 tarea llegas a ${t.initial + t.bonus} pts y cobras`,
    },
  ];
}

export default function LandingPage() {
  const router = useRouter();
  const { status } = useSession();
  const [terms, setTerms] = useState(FALLBACK);

  // 報酬額・開放日・枠の期限を実値で出す。取得に失敗したら既定値のまま描く
  // （LP自体が落ちる方が実害が大きい）
  useEffect(() => {
    getCampaignStatus()
      .then((s) =>
        setTerms({
          initial: s.reward_points_initial,
          bonus: s.reward_points_bonus,
          opensAt: s.withdrawals_open_at ?? FALLBACK.opensAt,
          reservationDays: s.reservation_days ?? FALLBACK.reservationDays,
          referral: s.referral_reward_points ?? FALLBACK.referral,
        })
      )
      .catch(() => {});
  }, []);

  const total = terms.initial + terms.bonus;

  // 招待リンク（?ref=）で来た場合にコードを保存する。ログインの往復を挟むので、
  // 適用はログイン後に ReferralClaimer が行う
  useEffect(() => {
    captureRefFromUrl();
  }, []);

  // ログイン済みならLPを見せずにHomeへ送る。
  // ルートに戻るたびログインを求められるように見えるのを防ぐ
  useEffect(() => {
    if (status === "authenticated") router.replace("/tareas");
  }, [status, router]);

  const goLogin = () => router.push(status === "authenticated" ? "/tareas" : "/ingresar");

  return (
    <div
      className="min-h-screen w-full cursor-pointer select-none bg-white"
      onClick={goLogin}
      role="button"
      aria-label="Ir a iniciar sesión"
    >
      {/* Hero */}
      <div className="bg-yellow-400">
        <div className="mx-auto w-full max-w-5xl px-6 pb-12 pt-6 sm:px-8">
          <Logo />
          {/* 1カラム。埋めるためだけの図版を置かない */}
          <div className="mt-10 max-w-2xl">
            {/* 事前登録の残り枠。希少性が登録の動機になるので最初に見せる。
              取得に失敗したら何も出ない（LP自体は成立する） */}
            <CampaignBadge />
            <p className="mt-2 inline-block rounded-full bg-white/40 px-3 py-1 text-sm text-neutral-800">
              🇵🇪 Solo en Perú
            </p>
            {/* 希少性を先に、金額を後に。金額だけを一番上に置くと、
                「登録するだけでお金」という詐欺の常套句と同じ形になる */}
            <h1
              className="mt-4 text-neutral-900"
              style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)", lineHeight: 1.25 }}
            >
              Sé uno de los primeros 100
              <br />
              en <span className="text-white">Perú</span>
            </h1>
            {/* ⚠️ 「登録するだけでS/5」に読めないよう、2段に分かれていることを
                ここで言い切る。金額だけ先に出すと詐欺の常套句と同じ形になる */}
            <p className="mt-3 max-w-xl text-neutral-800">
              Te reservamos <strong>S/ {soles(total)}</strong> en puntos:{" "}
              <strong>
                {terms.initial} al registrar tu número de Yape
              </strong>{" "}
              y {terms.bonus} más al completar tu primera tarea. Los cobras por
              Yape desde el {longDate(terms.opensAt)}.
            </p>
            {/* 枠に期限があることは登録の**前**に伝える。規約にしか書いて
                いないと「知らないうちに枠が消えた」になる */}
            <p className="mt-2 max-w-xl text-sm text-neutral-800">
              Tu cupo se guarda <strong>{terms.reservationDays} días</strong>.
              Si no registras tu número en ese plazo, pasa a otra persona.
            </p>
            {/* ⚠️ ペルーで「登録するだけでお金」は詐欺の典型。仕組みを
                説明しないと、まともな人ほど登録しない */}
            <p className="mt-3 max-w-xl rounded-2xl bg-white/50 px-4 py-3 text-sm text-neutral-800">
              <strong>¿Por qué te damos puntos?</strong> Ganamos dinero cuando
              los anunciantes pagan por nuevos usuarios. Te adelantamos parte
              de eso para que pruebes la plataforma. No te pedimos dinero, ni
              tarjeta, ni datos de tu banco. Nunca.
            </p>

            {/* 登録の前に招待コードを確かめられるようにする。
                後から入れる形だと、入ったかどうか分からないまま登録させることになる */}
            <InviteIntro />

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {/* 登録が主。以前はブログが主になっていたが、いま集めたいのは登録 */}
              <Button
                size="lg"
                className="h-12 bg-neutral-900 px-8 text-white hover:bg-neutral-800"
              >
                Crear mi cuenta
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-neutral-900 bg-transparent px-8 text-neutral-900 hover:bg-white/40"
              >
                <a href="/blog" onClick={(e) => e.stopPropagation()}>
                  Leer las guías
                </a>
              </Button>
            </div>
            <p className="mt-3 text-sm text-neutral-800">
              Sin pagar nada. Sin tarjeta. Solo tu correo o tu cuenta de Google.
            </p>
          </div>
        </div>
      </div>

      {/* 3 steps */}
      <div className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-8">
        <h2 className="text-center">Cómo funciona</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {steps(terms).map((s, i) => (
            <div
              key={s.title}
              className="flex items-center gap-4 rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm sm:flex-col sm:items-start sm:p-6"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600">
                <s.icon className="h-6 w-6" />
              </div>
              <div>
                <span className="text-sm text-yellow-500">PASO {i + 1}</span>
                <div className="text-neutral-900">{s.title}</div>
                <p className="text-sm text-neutral-500">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl bg-neutral-900 p-8 text-center text-white">
          <p className="text-sm text-neutral-300">Invita y gana más</p>
          <p style={{ fontSize: "1.5rem" }} className="mt-1">
            {terms.referral} pts por cada amigo
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm text-neutral-300">
            Comparte tu código durante el pre-registro. Recibes los puntos
            cuando tu amigo empiece a completar tareas.
          </p>
          <Button className="mx-auto mt-4 h-11 w-full max-w-sm bg-yellow-400 text-neutral-900 hover:bg-yellow-300">
            Crear mi cuenta y obtener mi código
          </Button>
        </div>
      </div>
    </div>
  );
}
