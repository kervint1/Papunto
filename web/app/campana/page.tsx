import type { Metadata } from "next";
import Link from "next/link";

import { LegalHeading as Heading, LegalLayout } from "@/components/LegalLayout";

/**
 * 規約に出す金額は**設定の実値**を読む。
 *
 * ⚠️ ここを固定文字にすると、管理画面で報酬を変えたときに規約だけ古い数字が
 *    残る。ペルーはINDECOPIの消費者保護が効いており、告知と実装の不一致は
 *    そのまま不当表示になる。
 *
 * APIが落ちているときは既定値で描く。規約ページ自体が500になる方が実害が
 * 大きいため。既定値は models/campaign_setting.py と揃えること。
 */
const FALLBACK = {
  initial: 300,
  bonus: 200,
  tasks: 1,
  opensAt: "2026-10-01",
  referral: 200,
  referralMax: 10,
  referralEarnings: 500,
  reservationDays: 7,
};

async function loadTerms() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/campaign/status`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return FALLBACK;
    const d = await res.json();
    return {
      initial: d.reward_points_initial,
      bonus: d.reward_points_bonus,
      tasks: d.bonus_required_tasks,
      opensAt: d.withdrawals_open_at ?? FALLBACK.opensAt,
      referral: d.referral_reward_points ?? FALLBACK.referral,
      referralMax: d.referral_max_per_user ?? FALLBACK.referralMax,
      referralEarnings:
        d.referral_required_earnings ?? FALLBACK.referralEarnings,
      reservationDays: d.reservation_days ?? FALLBACK.reservationDays,
    };
  } catch {
    return FALLBACK;
  }
}

function soles(points: number) {
  return (points / 100).toFixed(2);
}

function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const metadata: Metadata = {
  title: "Bases de la campaña de pre-registro",
  description:
    "Condiciones de la campaña de pre-registro de Papunto: cupos, recompensa, fecha de canje y causales de exclusión.",
  alternates: { canonical: "/campana" },
};

/**
 * 事前登録キャンペーンの規約。
 *
 * 体裁は実際の法務ページ（Rappi Perú 等）に合わせている。
 * **カード・枠線・影を使わない。** 白地に文字を置き、見出しは小さい大文字、
 * 本文は小さめで行間を広く、横幅を狭く取る。囲みを重ねると
 * 「テンプレートを埋めただけ」に見え、規約としての信用を損なう。
 *
 * ⚠️ 除外条件は**具体的に**書く。ペルーはINDECOPIの消費者保護が効いており、
 *    「当社の判断により除外する」のような曖昧な条項は不当条項とみなされ得る。
 *    実装（campaign_service）と、この文面を必ず一致させること。
 *
 * ⚠️ 開放日はサーバーの WITHDRAWALS_OPEN_AT と揃える。ずれると
 *    「書いてある日に交換できない」という最悪の形になる。
 */
export default async function CampanaPage() {
  const t = await loadTerms();

  return (
    <LegalLayout
      title="Bases de la campaña de pre-registro"
      updated="22 de agosto de 2026"
      current="/campana"
    >
      <p>
        Estas bases regulan la campaña de pre-registro de Papunto. Al crear
        una cuenta aceptas estas condiciones, junto con los{" "}
        <Link href="/terminos" className="underline">
          Términos de Uso
        </Link>{" "}
        y la{" "}
        <Link href="/privacidad" className="underline">
          Política de Privacidad
        </Link>
        .
      </p>

      <Heading>Quiénes pueden participar</Heading>
      <p className="mt-3">
        Personas naturales mayores de 18 años residentes en Perú, que creen
        una cuenta en Papunto durante el período de la campaña.
      </p>

      <Heading>Cupos y orden</Heading>
      <p className="mt-3">
        La campaña tiene un número limitado de cupos. El orden se asigna
        según el momento de creación de la cuenta: la primera cuenta creada
        recibe el número 1, la siguiente el 2, y así sucesivamente.
      </p>
      <p className="mt-3">
        Crear la cuenta reserva tu cupo. La entrega de los puntos ocurre
        después, según se indica más abajo.
      </p>

      {/* ⚠️ 枠の有効期限。**必ず先に告知してある状態を保つこと。**
          除外条件（下）は「únicamente」で閉じた列挙なので、後から期限を
          課すことはできない。登録はメールアドレスだけででき、その瞬間に
          枠を消費するため、期限が無いとフリーメールの手動登録だけで
          100枠を埋められる。実装は campaign_settings.reservation_days */}
      <p className="mt-3">
        <strong className="font-semibold text-neutral-900">
          El cupo se reserva por {t.reservationDays} días.
        </strong>{" "}
        Dentro de ese plazo debes registrar el número de celular con el que
        vas a cobrar. Si no lo haces, el cupo queda libre y pasa al siguiente
        participante en orden de registro. Puedes ver la fecha límite en tu
        cuenta.
      </p>
      <p className="mt-3">
        Una vez que registras tu número y recibes los primeros{" "}
        {t.initial} puntos, el cupo queda confirmado y ya no vence.
      </p>

      <p className="mt-3">
        Puedes ver los cupos restantes en tu cuenta y en la página principal.
      </p>

      <Heading>Recompensa</Heading>
      <p className="mt-3">
        La recompensa se entrega en dos partes:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          {/* ⚠️ 「登録した時点」ではない。付与は電話番号の登録時。
              実装と告知が食い違うとINDECOPI上そのまま問題になる */}
          <strong className="font-semibold text-neutral-900">
            {t.initial} puntos (S/ {soles(t.initial)})
          </strong>{" "}
          al registrar el número de celular con el que recibirás el pago.
          Puedes hacerlo en cualquier momento; crear la cuenta solo reserva
          tu cupo.
        </li>
        <li>
          <strong className="font-semibold text-neutral-900">
            {t.bonus} puntos (S/ {soles(t.bonus)})
          </strong>{" "}
          adicionales al completar {t.tasks}{" "}
          {t.tasks === 1 ? "tarea" : "tareas"} en la plataforma. Se cuentan
          las tareas cuyo cumplimiento haya sido confirmado por el
          anunciante.
        </li>
      </ul>
      <p className="mt-3">
        Los {t.initial} puntos iniciales por sí solos no alcanzan el mínimo
        requerido para canjear. {/* ⚠️ タスクの提供開始日を約束しない。
        提供はASPの審査結果に左右され、こちらで決められないため。
        交換の開放日（下の節）はこちらで決められるので日付で書いてよい */}
        Te avisaremos por correo cuando las tareas estén disponibles.
      </p>
      <p className="mt-3">
        Los puntos no son dinero ni instrumento financiero. Se convierten a
        Soles únicamente mediante el Canje, según los Términos de Uso.
      </p>

      <Heading>Campaña de invitación</Heading>
      <p className="mt-3">
        Cada cuenta recibe un código de invitación. Si una persona crea su
        cuenta usando tu código, recibes{" "}
        <strong className="font-semibold text-neutral-900">
          {t.referral} puntos (S/ {soles(t.referral)})
        </strong>
        .
      </p>
      <p className="mt-3">
        Condiciones:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          Cada persona puede usar un código de invitación una sola vez, al
          crear su cuenta. No se puede aplicar después ni cambiarlo.
        </li>
        <li>No puedes usar tu propio código.</li>
        <li>
          El máximo de invitaciones premiadas por cuenta es de{" "}
          {t.referralMax}.
        </li>
        <li>
          {/* 条件を検証可能な事実で書く。「当社の判断により」のような
              曖昧な条項は不当条項とみなされ得る */}
          El premio se entrega cuando la persona invitada haya ganado{" "}
          <strong className="font-semibold text-neutral-900">
            {t.referralEarnings} puntos
          </strong>{" "}
          completando tareas. No se cuentan los puntos de esta campaña ni los
          de invitaciones. Crear la cuenta no es suficiente.
        </li>
      </ul>
      {/* 期間限定であることを明示する。後で金額を下げるときに
          「話が違う」にならないようにするため。すでに確定した分は
          台帳に金額が残るので変更の影響を受けない */}
      <p className="mt-3">
        Este monto corresponde a una campaña y puede cambiar o terminar más
        adelante. Las invitaciones ya confirmadas conservan el premio con el
        que se confirmaron.
      </p>

      <Heading>Cuándo puedes canjear</Heading>
      <p className="mt-3">
        El canje estará disponible a partir del {longDate(t.opensAt)}. Antes
        de esa fecha los puntos se acumulan en tu cuenta, pero no pueden
        convertirse a Soles.
      </p>
      <p className="mt-3">
        Para canjear necesitas registrar el número de celular con el que
        recibirás el pago por Yape. No te pedimos ese número al crear la
        cuenta.
      </p>

      {/* 曖昧な裁量条項にしない。判定できる事実だけを書く */}
      <Heading>Causales de exclusión</Heading>
      <p className="mt-3">
        Una cuenta queda excluida de la campaña únicamente en los
        siguientes casos:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          {/* ⚠️ 「同じ番号での重複登録」は書かない。UNIQUE制約で2つ目の登録
              自体が拒否されるので、発生しえない条項になる。
              実際に起きるのは「同じ人が別々の番号で複数アカウント」の方 */}
          <strong className="font-semibold text-neutral-900">
            Varias cuentas de la misma persona.
          </strong>{" "}
          Si al momento del pago se verifica que dos o más cuentas cobran a
          nombre del mismo titular, solo se mantiene la cuenta que se
          registró primero; las demás quedan excluidas.
        </li>
        <li>
          <strong className="font-semibold text-neutral-900">
            Datos falsos.
          </strong>{" "}
          Si el número registrado no pertenece al titular de la cuenta.
        </li>
        <li>
          <strong className="font-semibold text-neutral-900">
            Uso automatizado.
          </strong>{" "}
          Creación de cuentas mediante programas, scripts o servicios de
          terceros.
        </li>
      </ul>
      <p className="mt-3">
        Si una cuenta queda excluida, su cupo pasa al siguiente
        participante en orden de registro. El número total de recompensas
        no disminuye.
      </p>

      <Heading>Uso de tu número de celular</Heading>
      <p className="mt-3">
        El número se usa únicamente para enviarte el pago por Yape y para
        verificar que no existan cuentas duplicadas. No realizamos llamadas
        ni entregamos el número a terceros.
      </p>
      <p className="mt-3">
        Una vez registrado, el número no puede modificarse desde la
        aplicación. Si necesitas cambiarlo, escríbenos.
      </p>

      <Heading>Modificaciones y cierre</Heading>
      <p className="mt-3">
        Podemos ampliar el número de cupos. Si lo hacemos, se anunciará en
        esta página y en la página principal.
      </p>
      <p className="mt-3">
        La campaña finaliza cuando se agotan los cupos o el 30 de
        septiembre de 2026, lo que ocurra primero.
      </p>

      <Heading>Reclamos</Heading>
      <p className="mt-3">
        Puedes presentar un reclamo o queja en nuestro{" "}
        <Link href="/reclamaciones" className="underline">
          Libro de Reclamaciones
        </Link>
        .
      </p>
    </LegalLayout>
  );
}
