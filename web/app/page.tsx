"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowRight } from "lucide-react";

import { CampaignBadge } from "@/components/CampaignBadge";
import { InviteIntro } from "@/components/InviteIntro";
import { Logo } from "@/components/Logo";
import { Section } from "@/components/lp/Section";
import { getCampaignStatus } from "@/lib/api";
import { captureRefFromUrl } from "@/lib/referral";

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
  referralMax: 10,
  referralEarnings: 500,
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

export default function LandingPage() {
  const router = useRouter();
  const { status } = useSession();
  const [t, setTerms] = useState(FALLBACK);

  useEffect(() => {
    getCampaignStatus()
      .then((s) =>
        setTerms({
          initial: s.reward_points_initial,
          bonus: s.reward_points_bonus,
          opensAt: s.withdrawals_open_at ?? FALLBACK.opensAt,
          reservationDays: s.reservation_days ?? FALLBACK.reservationDays,
          referral: s.referral_reward_points ?? FALLBACK.referral,
          referralMax: s.referral_max_per_user ?? FALLBACK.referralMax,
          referralEarnings:
            s.referral_required_earnings ?? FALLBACK.referralEarnings,
        })
      )
      .catch(() => {});
  }, []);

  // 招待リンク（?ref=）で来た場合にコードを保存する。ログインの往復を挟むので、
  // 適用はログイン後に ReferralClaimer が行う
  useEffect(() => {
    captureRefFromUrl();
  }, []);

  // ログイン済みならLPを見せずにHomeへ送る
  useEffect(() => {
    if (status === "authenticated") router.replace("/tareas");
  }, [status, router]);

  const goLogin = () => router.push("/ingresar");
  const total = t.initial + t.bonus;
  const fecha = longDate(t.opensAt);

  /**
   * ⚠️ **「登録したら300pt」と書かない。** 付与は電話番号の登録時。
   *    「登録するだけでお金」はペルーで詐欺の典型句で、それを避けるために
   *    付与のタイミングを分けてある。番号は不正対策の土台でもある
   *    （1番号1アカウント）。文言が戻ると設計の意味が消える。
   */
  /**
   * サービスとして何をするところか。**キャンペーンの手順とは別**。
   *
   * これが無いと「S/5もらえる」ことしか書いていないLPになり、詐欺を疑って
   * いる人が一番知りたい「何をするアプリか」が伝わらない。日付や約束は
   * 入れない（それは下の「Cómo funciona」の仕事）。
   */
  const ABOUT = [
    {
      title: "Creas tu cuenta",
      desc: "Con tu correo, Google o Facebook. Gratis y sin tarjeta.",
      img: "/lp/paso-cuenta.jpg",
      alt: "Pantalla de registro de Papunto en un celular",
    },
    {
      title: "Completas tareas",
      desc: "Encuestas, registros y pruebas de apps. Cada una te da puntos.",
      img: "/lp/paso-tareas.jpg",
      alt: "Lista de tareas y puntos de Papunto",
    },
    {
      // ⚠️ 挿絵に Plin と SIMリチャージ が写っているが、いま選べるのは Yape だけ。
      //    画像も表示に含まれるので、使えないものを使えるように見せない。
      //
      //    recarga  Reloadly で実装済みだが available:false。本番の残高を
      //             入れるまで開けない（サンドボックスのまま公開すると
      //             「ポイントは引かれたのに届かない」になる）
      //    Plin     未実装。lib/exchangeDestinations.ts にも無い
      title: "Cambias tus puntos por dinero",
      desc: "Hoy te lo enviamos por Yape, a tu número de celular. Recargas de celular y Plin: próximamente.",
      img: "/lp/paso-cobro.jpg",
      alt: "Puntos de Papunto convertidos en dinero por Yape",
    },
  ];

  const STEPS = [
    {
      when: "Hoy",
      title: "Crea tu cuenta",
      desc: `Reservamos tu cupo entre los primeros 100. Lo guardamos ${t.reservationDays} días.`,
    },
    {
      when: "Hoy",
      title: "Registra tu número de Yape",
      desc: `Te acreditamos ${t.initial} puntos (S/ ${soles(t.initial)}) al instante. Es el número donde vas a cobrar.`,
    },
    {
      when: fecha,
      title: "Abrimos las tareas",
      desc: `Completa 1 tarea y recibes ${t.bonus} puntos más. Desde ${total} puntos (S/ ${soles(total)}) pides tu dinero por Yape.`,
    },
  ];

  const FAQ = [
    {
      q: "¿De verdad pagan?",
      a: `Sí. Pagamos por Yape desde ${total} puntos (S/ ${soles(total)}). El canje se abre el ${fecha} y te avisamos por correo.`,
    },
    {
      // ⚠️ デザイン案は「登録時には要らない」と書いていたが逆。番号の登録が
      //    300ptの条件そのもの。ここを曖昧にすると実装と食い違う
      q: "¿Por qué me piden mi número de celular?",
      a: `Porque el pago llega por Yape y ese número es tu cuenta de cobro. También sirve para que una persona no cree varias cuentas: un número, una cuenta. Al registrarlo recibes los ${t.initial} puntos.`,
    },
    {
      // 集客はFacebookグループ。そこから来た人はアプリ内ブラウザで
      // Googleログインが動かない（403 disallowed_useragent）
      q: "¿Necesito una cuenta de Google?",
      a: "No. Puedes entrar con tu correo, con Google o con Facebook. Si abriste este enlace dentro de la app de Facebook, entra con tu correo.",
    },
    {
      q: "¿Cuánto puedo ganar?",
      a: `En el pre-registro, ${total} puntos (S/ ${soles(total)}). Después depende de las tareas que completes.`,
    },
    {
      q: "¿Me van a cobrar algo?",
      a: "Nunca. No te pedimos dinero, ni tarjeta, ni datos de tu banco.",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-white text-neutral-900">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
          <Logo />
          <nav className="flex items-center gap-5 text-sm">
            <a href="#pasos" className="hidden text-neutral-600 hover:text-neutral-900 sm:inline">
              Cómo funciona
            </a>
            <a href="#faq" className="hidden text-neutral-600 hover:text-neutral-900 sm:inline">
              Preguntas
            </a>
            <button
              type="button"
              onClick={goLogin}
              className="border-b border-neutral-900 pb-0.5 text-neutral-900"
            >
              Crear mi cuenta
            </button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[#FFC800]">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-neutral-800/70">
            Pre-registro · Perú
          </p>
          <h1
            className="mt-6 max-w-4xl"
            style={{
              fontSize: "clamp(2.25rem, 6vw, 4.25rem)",
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
            }}
          >
            Sé uno de los primeros 100 en Perú
          </h1>

          {/* ⚠️ 「登録するだけでS/5」に読めないよう、2段に分かれていることを
              ここで言い切る。金額だけ先に出すと詐欺の常套句と同じ形になる */}
          <p className="mt-7 max-w-2xl text-lg leading-relaxed sm:text-xl">
            Te reservamos <strong>S/ {soles(total)}</strong> en puntos:{" "}
            <strong>{t.initial} al registrar tu número de Yape</strong> y{" "}
            {t.bonus} más al completar tu primera tarea.
          </p>
          <p className="mt-3 max-w-2xl text-neutral-800">
            Sin pagar nada. Sin tarjeta. Entra con tu correo, Google o Facebook.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={goLogin}
              className="inline-flex items-center gap-3 bg-neutral-900 px-8 py-4 text-white transition-colors hover:bg-neutral-800"
            >
              Crear mi cuenta
              <ArrowRight className="h-4 w-4" />
            </button>
            <a href="#registro" className="text-sm underline underline-offset-4">
              ¿Tienes un código de invitación?
            </a>
          </div>

          <div className="mt-10">
            <CampaignBadge />
          </div>
          {/* 枠に期限があることは登録の**前**に伝える。規約にしか書いて
              いないと「知らないうちに枠が消えた」になる */}
          <p className="mt-3 font-mono text-xs tracking-wide text-neutral-800/70">
            Tu cupo se guarda {t.reservationDays} días
          </p>
        </div>
      </section>

      {/* ⚠️ ペルーで「登録するだけでお金」は詐欺の典型。仕組みを説明しないと、
          まともな人ほど登録しない */}
      <Section kicker="Rewards" title="¿Por qué te damos puntos gratis?">
        <p className="mt-7 text-lg leading-relaxed text-neutral-700">
          Papunto gana dinero cuando los anunciantes pagan por nuevos usuarios.
          Te adelantamos parte de eso para que pruebes la plataforma cuando
          abramos las tareas.
        </p>
        <p className="mt-6 text-xl leading-snug text-neutral-900">
          No te pedimos dinero, ni tarjeta, ni datos de tu banco. Nunca.
        </p>
      </Section>

      {/* サービスの説明。キャンペーンの手順（下）とは役割が違う。
          「S/5もらえる」しか書いていないと、詐欺を疑っている人が一番
          知りたい「何をするアプリか」が伝わらない */}
      <Section kicker="The app" title="Qué es Papunto">
        <p className="mt-6 text-neutral-500">
          Ganas puntos completando tareas y los cambias por dinero.
        </p>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {ABOUT.map((a) => (
            <div key={a.title}>
              {/* 挿絵。読めなくても説明は成立するので lazy でよい */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.img}
                alt={a.alt}
                loading="lazy"
                className="aspect-[4/3] w-full rounded-xl bg-neutral-50 object-cover"
              />
              <div className="mt-4 text-neutral-900">{a.title}</div>
              <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                {a.desc}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="pasos" kicker="How it works" title="Cómo funciona">
        <p className="mt-6 text-neutral-500">
          Tres pasos, de hoy hasta el día que cobras.
        </p>
        <ol className="mt-10">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="grid gap-2 border-t border-black/10 py-7 sm:grid-cols-[64px_128px_1fr] sm:gap-6"
            >
              <span className="font-mono text-sm text-neutral-400">0{i + 1}</span>
              <span className="font-mono text-sm text-neutral-500">{s.when}</span>
              <div>
                <div className="text-lg text-neutral-900">{s.title}</div>
                <p className="mt-1 text-neutral-600">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* ⚠️ 「友達が登録したら」ではない。友達がタスクで稼いで初めて成立する。
          登録で成立させると、メールを量産するだけで報酬が積み上がる */}
      <Section kicker="Referral" title={`Invita y gana ${t.referral} puntos por amigo`}>
        <p className="mt-7 text-lg leading-relaxed text-neutral-700">
          Comparte tu código durante el pre-registro. Recibes{" "}
          <strong className="text-neutral-900">
            {t.referral} puntos (S/ {soles(t.referral)})
          </strong>{" "}
          cuando tu amigo haya ganado {t.referralEarnings} puntos completando
          tareas. Crear la cuenta no es suficiente.
        </p>
        <p className="mt-4 text-sm text-neutral-500">
          Hasta {t.referralMax} amigos premiados por cuenta.
        </p>
      </Section>

      {/* 登録の前に招待コードを確かめられるようにする。後から入れる形だと、
          入ったかどうか分からないまま登録させることになる */}
      <Section id="registro" kicker="Code" title="¿Te invitó un amigo?" compact>
        <div className="mt-6">
          <InviteIntro />
        </div>
      </Section>

      <Section id="faq" kicker="FAQ" title="Preguntas frecuentes">
        <dl className="mt-10">
          {FAQ.map((f) => (
            <div key={f.q} className="border-t border-black/10 py-6">
              <dt className="text-lg text-neutral-900">{f.q}</dt>
              <dd className="mt-2 leading-relaxed text-neutral-600">{f.a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <section className="mt-20 bg-[#FFC800] sm:mt-28">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-20">
          <h2
            className="max-w-3xl"
            style={{
              fontSize: "clamp(1.75rem, 4vw, 3rem)",
              letterSpacing: "-0.035em",
              lineHeight: 1.1,
            }}
          >
            Sé uno de los primeros 100 en Perú
          </h2>
          <p className="mt-4 text-neutral-800">
            Sin pagar nada. Sin tarjeta. Entra con tu correo, Google o Facebook.
          </p>
          <button
            type="button"
            onClick={goLogin}
            className="mt-8 inline-flex items-center gap-3 bg-neutral-900 px-8 py-4 text-white transition-colors hover:bg-neutral-800"
          >
            Crear mi cuenta
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
