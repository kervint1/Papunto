import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Bases de la campaña de pre-registro",
  description:
    "Condiciones de la campaña de pre-registro de Papunto: cupos, recompensa, fecha de canje y causales de exclusión.",
  alternates: { canonical: "/campana" },
};

/**
 * 事前登録キャンペーンの規約。
 *
 * ⚠️ 除外条件は**具体的に**書く。ペルーはINDECOPIの消費者保護が効いており、
 *    「当社の判断により除外する」のような曖昧な条項は不当条項とみなされ得る。
 *    実装（campaign_service）と、この文面を必ず一致させること。
 *
 * ⚠️ 開放日はサーバーの WITHDRAWALS_OPEN_AT と揃える。ずれると
 *    「書いてある日に交換できない」という最悪の形になる。
 */
function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-neutral-100 pt-6 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold text-neutral-900">
        {n}. {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-neutral-600">
        {children}
      </div>
    </section>
  );
}

export default function CampanaPage() {
  return (
    <div className="min-h-screen w-full bg-neutral-50">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/">
          <Logo />
        </Link>

        <h1 className="mt-6">Bases de la campaña de pre-registro</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Última revisión: 18 de agosto de 2026
        </p>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Estas bases regulan la campaña de pre-registro de Papunto. Al
          registrarte aceptas estas condiciones, junto con los{" "}
          <Link href="/terminos" className="underline">
            Términos de Uso
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" className="underline">
            Política de Privacidad
          </Link>
          .
        </p>

        <div className="mt-6 flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
          <Section n={1} title="Quiénes pueden participar">
            <p>
              Personas naturales mayores de 18 años residentes en Perú, que
              creen una cuenta en Papunto durante el período de la campaña.
            </p>
          </Section>

          <Section n={2} title="Cupos y orden">
            <p>
              La campaña tiene un número limitado de cupos. El orden se asigna
              <strong> según el momento de creación de la cuenta</strong>: la
              primera cuenta creada recibe el número 1, la siguiente el 2, y así
              sucesivamente.
            </p>
            <p>
              Puedes ver tu número y los cupos restantes en tu cuenta y en la
              página principal.
            </p>
          </Section>

          <Section n={3} title="Recompensa">
            <p>
              Cada participante dentro de los cupos recibe{" "}
              <strong>500 puntos (equivalentes a S/ 5.00)</strong>, acreditados
              en su cuenta al momento del registro.
            </p>
            <p>
              Los puntos no son dinero ni instrumento financiero. Se convierten
              a Soles únicamente mediante el Canje, según los Términos de Uso.
            </p>
          </Section>

          <Section n={4} title="Cuándo puedes canjear">
            <p>
              El canje estará disponible a partir del{" "}
              <strong>1 de octubre de 2026</strong>. Antes de esa fecha los
              puntos se acumulan en tu cuenta, pero no pueden convertirse a
              Soles.
            </p>
            <p>
              Para canjear necesitas registrar el número de celular con el que
              recibirás el pago por Yape. No te pedimos ese número al crear la
              cuenta.
            </p>
          </Section>

          {/* 曖昧な裁量条項にしない。具体的な事実で判定する */}
          <Section n={5} title="Causales de exclusión">
            <p>
              Una cuenta queda excluida de la campaña únicamente en los
              siguientes casos:
            </p>
            <ul className="ml-4 list-disc space-y-2">
              <li>
                <strong>Número de celular duplicado.</strong> Si dos o más
                cuentas registran el mismo número, solo se mantiene la cuenta
                que se registró primero; las demás quedan excluidas.
              </li>
              <li>
                <strong>Datos falsos.</strong> Si el número registrado no
                pertenece al titular de la cuenta.
              </li>
              <li>
                <strong>Uso automatizado.</strong> Creación de cuentas mediante
                programas, scripts o servicios de terceros.
              </li>
            </ul>
            <p>
              Si una cuenta queda excluida, su cupo pasa al siguiente
              participante en orden de registro. El número total de recompensas
              no disminuye.
            </p>
          </Section>

          <Section n={6} title="Uso de tu número de celular">
            <p>
              El número se usa <strong>únicamente para enviarte el pago</strong>{" "}
              por Yape y para verificar que no existan cuentas duplicadas.
            </p>
            <p>
              No realizamos llamadas ni entregamos el número a terceros. Ver la{" "}
              <Link href="/privacidad" className="underline">
                Política de Privacidad
              </Link>
              .
            </p>
            <p>
              Una vez registrado, el número no puede modificarse desde la
              aplicación. Si necesitas cambiarlo, escríbenos.
            </p>
          </Section>

          <Section n={7} title="Modificaciones y cierre">
            <p>
              Podemos ampliar el número de cupos. Si lo hacemos, se anunciará en
              esta página y en la página principal.
            </p>
            <p>
              La campaña finaliza cuando se agotan los cupos o el 30 de
              septiembre de 2026, lo que ocurra primero.
            </p>
          </Section>

          <Section n={8} title="Reclamos">
            <p>
              Puedes presentar un reclamo o queja en nuestro{" "}
              <Link href="/reclamaciones" className="underline">
                Libro de Reclamaciones
              </Link>
              .
            </p>
          </Section>
        </div>

        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-neutral-500 underline">
            Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
