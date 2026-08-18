import type { Metadata } from "next";
import Link from "next/link";

import { LegalHeading as Heading, LegalLayout } from "@/components/LegalLayout";

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
export default function CampanaPage() {
  return (
    <LegalLayout
      title="Bases de la campaña de pre-registro"
      updated="18 de agosto de 2026"
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
        Puedes ver tu número y los cupos restantes en tu cuenta y en la
        página principal.
      </p>

      <Heading>Recompensa</Heading>
      <p className="mt-3">
        Cada participante dentro de los cupos recibe 500 puntos
        (equivalentes a S/ 5.00), acreditados en su cuenta al momento del
        registro.
      </p>
      <p className="mt-3">
        Los puntos no son dinero ni instrumento financiero. Se convierten a
        Soles únicamente mediante el Canje, según los Términos de Uso.
      </p>

      <Heading>Cuándo puedes canjear</Heading>
      <p className="mt-3">
        El canje estará disponible a partir del 1 de octubre de 2026. Antes
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
          <strong className="font-semibold text-neutral-900">
            Número de celular duplicado.
          </strong>{" "}
          Si dos o más cuentas registran el mismo número, solo se mantiene
          la cuenta que se registró primero; las demás quedan excluidas.
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
