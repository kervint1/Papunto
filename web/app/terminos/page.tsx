import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Condiciones de uso del servicio Papunto: puntos, canjes por Yape, y responsabilidades del usuario.",
  alternates: { canonical: "/terminos" },
};

import { LegalLayout } from "@/components/LegalLayout";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mt-10 text-[0.8125rem] font-semibold uppercase tracking-wide text-neutral-900">
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-neutral-700">
        {children}
      </div>
    </section>
  );
}

export default function TerminosPage() {
  return (
    <LegalLayout
      title="Términos de Uso"
      updated="22 de agosto de 2026"
      current="/terminos"
    >
        <p className="mt-3 text-sm leading-relaxed text-neutral-700">
          Para utilizar Papunto (el &ldquo;Servicio&rdquo;), operado por su
          titular (el &ldquo;Titular&rdquo;, ver{" "}
          <Link href="/privacidad" className="underline">
            Política de Privacidad
          </Link>
          ), es necesario que leas, entiendas y aceptes estos Términos de Uso
          (los &ldquo;Términos&rdquo;). El registro o uso del Servicio implica
          la aceptación plena de estos Términos.
        </p>

          {/* Definiciones */}
          <section>
            <h2 className="mt-10 text-[0.8125rem] font-semibold uppercase tracking-wide text-neutral-900">
              1. Definiciones
            </h2>
            <div className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-neutral-700">
              <p>
                <strong>Usuario:</strong> persona natural que, habiendo
                aceptado estos Términos, se ha registrado en el Servicio y
                puede utilizarlo.
              </p>
              <p>
                <strong>Puntos:</strong> unidad interna de recompensa otorgada
                al Usuario por completar Tareas. Los Puntos no constituyen
                dinero, moneda de curso legal ni instrumento financiero; son
                intercambiables únicamente por Soles a través del Canje, en
                los términos de la Sección 4.
              </p>
              <p>
                <strong>Tarea u Oferta:</strong> acción (por ejemplo, instalar
                una aplicación, registrarse en un servicio o completar una
                encuesta) publicada por Monlix u otro proveedor de ofertas
                afiliado, cuya finalización correcta otorga Puntos al Usuario.
              </p>
              <p>
                <strong>Monlix:</strong> plataforma de terceros
                (&ldquo;offerwall&rdquo;) integrada en el Servicio que provee,
                verifica y determina el cumplimiento de las Tareas.
              </p>
              <p>
                <strong>Yape:</strong> aplicación de pagos operada por el
                Banco de Crédito del Perú (BCP), ajena al Titular, utilizada
                como medio para el pago de los Canjes.
              </p>
              <p>
                <strong>Canje:</strong> solicitud del Usuario para convertir
                sus Puntos acumulados en un pago en Soles a su cuenta Yape.
              </p>
            </div>
          </section>

          {/* Registro */}
          <Section title="2. Registro y elegibilidad">
            <p>
              Para registrarte en el Servicio debes iniciar sesión con tu
              cuenta de Google y tener al menos 18 años de edad. Al
              registrarte, declaras que la información que compartes (nombre,
              correo electrónico) es veraz y te corresponde.
            </p>
            <p>
              Solo se permite una (1) cuenta por persona. El Titular podrá
              rechazar un registro o suspender una cuenta si detecta que:
            </p>
            <ul className="list-disc pl-5">
              <li>La persona registrada no existe o los datos son falsos.</li>
              <li>El Usuario tiene o ha tenido otra cuenta en el Servicio.</li>
              <li>El registrante es menor de 18 años.</li>
              <li>
                Existen indicios de que la cuenta se usa con fines
                fraudulentos o comerciales no autorizados.
              </li>
            </ul>
            <p>
              El Titular no está obligado a explicar los motivos de un
              rechazo o suspensión de cuenta, sin perjuicio de los derechos
              que te correspondan por ley.
            </p>
            <p>
              La cuenta es personal e intransferible: no puede prestarse,
              cederse, venderse ni compartirse con terceros. El Usuario es
              responsable de mantener la confidencialidad de su acceso y de
              toda actividad realizada desde su cuenta, así como de mantener
              una dirección de correo electrónico válida y accesible.
            </p>
            <p>
              Al registrarte, aceptas recibir comunicaciones esenciales
              relacionadas con el Servicio (por ejemplo, notificaciones sobre
              tu cuenta o tus Canjes) al correo electrónico asociado a tu
              cuenta de Google.
            </p>
          </Section>

          {/* Sistema de puntos */}
          <Section title="3. Obtención de Puntos">
            <p>
              Los Puntos se otorgan cuando Monlix (u otro proveedor de
              ofertas afiliado) confirma que has completado correctamente una
              Tarea, conforme a las condiciones específicas de dicha Tarea.
              El Titular no participa en la verificación del cumplimiento de
              las Tareas: dicha determinación corresponde exclusivamente a
              Monlix o al proveedor de la oferta.
            </p>
            <p>
              No se otorgarán Puntos si: (i) la Tarea no fue completada según
              las condiciones indicadas; (ii) Monlix determina que la
              conclusión fue fraudulenta, automatizada o inválida; o (iii) la
              notificación de Monlix no pudo procesarse correctamente por
              errores técnicos ajenos al Titular.
            </p>
            <p>
              El Titular podrá anular o descontar Puntos ya otorgados, incluso
              de forma retroactiva, cuando se determine que fueron obtenidos
              mediante fraude, manipulación técnica, uso de bots, automatismos
              o cualquier medio no genuino, o cuando Monlix revierta el
              reconocimiento de la Tarea correspondiente.
            </p>
            <p>
              En caso de error de sistema que resulte en una asignación de
              Puntos incorrecta, el Titular podrá ajustar el saldo del Usuario
              para reflejar el valor correcto.
            </p>
            <p>
              Los Puntos son personales e intransferibles: pertenecen
              únicamente al Usuario que los obtuvo y no pueden compartirse,
              venderse, comprarse, intercambiarse, cederse ni transferirse a
              otros usuarios o terceros por ningún medio.
            </p>
          </Section>

          {/* Canje */}
          <Section title="4. Canje de Puntos por Yape">
            <p>
              El Usuario podrá solicitar el Canje de sus Puntos siempre que
              cuente con el saldo mínimo vigente (consultable en la sección
              Billetera del Servicio) y proporcione un número de teléfono
              Yape válido y a su nombre.
            </p>
            <p>
              El Canje solo puede solicitarse en múltiplos de la tasa de
              conversión vigente, para evitar fracciones de Sol. La tasa de
              conversión y el monto mínimo de Canje son determinados por el
              Titular y pueden actualizarse en cualquier momento; el valor
              vigente al momento de la solicitud es el que se aplica.
            </p>
            <p>
              Solo puede existir una solicitud de Canje pendiente por Usuario
              a la vez. Al confirmar la solicitud, los Puntos correspondientes
              se descuentan de inmediato del saldo del Usuario.
            </p>
            <p>
              El pago se realiza mediante transferencia manual a través de
              Yape, en un plazo estimado de 1 a 2 días hábiles desde la
              solicitud. Si la solicitud es rechazada (por ejemplo, por datos
              incorrectos o sospecha de fraude), los Puntos descontados serán
              devueltos al saldo del Usuario.
            </p>
            <p>
              El Titular podrá exigir, antes de procesar un Canje —en especial
              el primero de cada Usuario o ante Canjes de montos inusuales—
              información adicional para verificar la identidad y elegibilidad
              del Usuario. La negativa a proporcionar dicha información en un
              plazo razonable puede resultar en la retención o denegación del
              Canje.
            </p>
          </Section>

          {/* Yape como tercero */}
          <Section title="5. Yape como servicio de terceros">
            <p>
              Yape es un servicio operado por el Banco de Crédito del Perú
              (BCP), completamente ajeno al Titular. El Titular no administra,
              controla ni es responsable por el funcionamiento, disponibilidad
              o seguridad de Yape, ni por errores, demoras o interrupciones
              atribuibles a dicho servicio o al Usuario (por ejemplo, un
              número de Yape inválido, inactivo o de un tercero).
            </p>
            <p>
              Es responsabilidad exclusiva del Usuario mantener una cuenta
              Yape activa y proporcionar un número de teléfono correcto. El
              Titular no será responsable por Canjes enviados a un número de
              Yape incorrecto proporcionado por el Usuario.
            </p>
          </Section>

          {/* Puntos: expiración y cuentas inactivas */}
          <Section title="6. Cuentas inactivas y expiración de Puntos">
            <p>
              Si una cuenta no registra actividad (inicio de sesión, obtención
              o canje de Puntos) durante un período prolongado, el Titular
              podrá considerarla inactiva. Antes de cualquier cancelación
              definitiva por inactividad, se notificará al Usuario a su correo
              electrónico registrado con una anticipación razonable.
            </p>
            <p>
              El Titular podrá establecer y modificar reglas de vigencia y
              caducidad de los Puntos. Los Puntos no reclamados o vencidos
              conforme a dichas reglas podrán ser retirados del saldo del
              Usuario, sin compensación.
            </p>
          </Section>

          {/* Impuestos */}
          <Section title="7. Impuestos">
            <p>
              El Usuario es responsable de cualquier obligación tributaria
              que, conforme a la normativa que le resulte aplicable, se
              derive de la obtención de Puntos o de la recepción de pagos por
              Canjes. El Titular no está en capacidad de determinar si dichos
              montos constituyen renta gravable para cada Usuario, por lo que
              se recomienda consultar con un asesor tributario en caso de
              duda.
            </p>
          </Section>

          {/* Conductas prohibidas */}
          <Section title="8. Conductas prohibidas">
            <p>Al usar el Servicio, el Usuario se compromete a no:</p>
            <ul className="list-disc pl-5">
              <li>Utilizar el Servicio con fines fraudulentos o comerciales no autorizados.</li>
              <li>
                Usar bots, scripts, automatismos, múltiples dispositivos,
                VPN/proxy para falsear tu ubicación u otros medios técnicos
                para simular actividad humana o completar Tareas de forma no
                genuina.
              </li>
              <li>Registrar o utilizar más de una cuenta por persona.</li>
              <li>
                Vender, comprar, intercambiar, ceder o transferir Puntos o
                cuentas, dentro o fuera del Servicio.
              </li>
              <li>
                Suplantar la identidad de otra persona, o proporcionar
                información falsa o de un tercero al registrarte o al
                solicitar un Canje.
              </li>
              <li>
                Acceder sin autorización, dañar o interferir con el
                funcionamiento del Servicio, sus servidores o bases de datos.
              </li>
              <li>Vulnerar derechos de propiedad intelectual del Titular o de terceros.</li>
              <li>Realizar cualquier acto contrario a la ley, la moral o el orden público.</li>
            </ul>
            <p>
              El incumplimiento de lo anterior puede resultar en la
              suspensión o cancelación de la cuenta y la pérdida de los
              Puntos acumulados, conforme a la Sección 9. Asimismo, el
              Usuario responderá por los daños que su incumplimiento cause al
              Titular o a terceros.
            </p>
          </Section>

          {/* Suspensión */}
          <Section title="9. Suspensión y cancelación de cuenta">
            <p>
              El Titular podrá suspender o cancelar la cuenta de un Usuario,
              a su sola discreción, cuando determine que el Usuario ha
              incumplido estos Términos, ha incurrido en alguna de las
              conductas prohibidas de la Sección 8, o cuando existan indicios
              razonables de fraude o uso indebido del Servicio.
            </p>
            <p>
              En caso de cancelación por incumplimiento, el Usuario perderá
              todos los Puntos acumulados y, de haber recibido Canjes
              obtenidos de forma fraudulenta, deberá restituir su valor al
              Titular.
            </p>
            {/* ⚠️ 自分で削除できるようになったので、メールでの依頼を前提にしない。
                Google Play の要件でもアプリ内とWebの両方に導線が要る */}
            <p>
              El Usuario puede eliminar su cuenta en cualquier momento desde{" "}
              <a href="/eliminar-cuenta" className="underline">
                papunto.pe/eliminar-cuenta
              </a>{" "}
              o desde la sección <strong>Mi cuenta</strong> en la aplicación.
              Al darse de baja, el Usuario pierde los Puntos no canjeados.
            </p>
          </Section>

          {/* Propiedad intelectual */}
          <Section title="10. Propiedad intelectual">
            <p>
              El Servicio, su marca, logotipo, diseño y contenidos son
              propiedad del Titular o de sus licenciantes y están protegidos
              por las leyes de propiedad intelectual aplicables. Queda
              prohibida su reproducción, modificación o distribución sin
              autorización expresa, salvo el uso personal y no comercial
              necesario para utilizar el Servicio.
            </p>
          </Section>

          {/* Publicidad y contenido de terceros */}
          <Section title="11. Ofertas y contenido de terceros">
            <p>
              Las Tareas y su contenido son proporcionados por Monlix y sus
              anunciantes, quienes son los únicos responsables de la
              veracidad, legalidad y condiciones de dichas Tareas. El Titular
              no garantiza ni se responsabiliza por el contenido, la
              disponibilidad ni los resultados de las Tareas ofrecidas por
              Monlix.
            </p>
            <p>
              Al participar en una Tarea, el Usuario se obliga también a
              cumplir los términos y condiciones propios de Monlix y del
              anunciante correspondiente, que se aplican de forma adicional a
              estos Términos.
            </p>
          </Section>

          {/* Disponibilidad del servicio */}
          <Section title="12. Disponibilidad, modificación y terminación del Servicio">
            <p>
              El Titular podrá modificar, ampliar o eliminar funcionalidades
              del Servicio en cualquier momento. Asimismo, el Servicio podrá
              interrumpirse temporalmente, sin previo aviso, por
              mantenimiento, fallas técnicas, causas de fuerza mayor o hechos
              de terceros (incluyendo indisponibilidad de Monlix, Yape u
              otros proveedores).
            </p>
            <p>
              El Titular podrá igualmente descontinuar el Servicio de forma
              definitiva. En tal caso, lo comunicará a los Usuarios con una
              anticipación razonable a través del Servicio o del correo
              electrónico registrado, para que los Usuarios con saldo
              suficiente puedan solicitar el Canje de sus Puntos antes del
              cierre, conforme a las condiciones de la Sección 4.
            </p>
          </Section>

          {/* Exención de garantías */}
          <Section title="13. Exención de garantías y limitación de responsabilidad">
            <p>
              El Servicio se proporciona &ldquo;tal cual&rdquo; y &ldquo;según
              disponibilidad&rdquo;, sin garantías de ningún tipo. El Titular
              no garantiza que el Servicio funcione de manera ininterrumpida
              o libre de errores.
            </p>
            <p>
              En la medida permitida por la ley aplicable, el Titular no será
              responsable por daños indirectos, incidentales o derivados del
              uso o la imposibilidad de uso del Servicio, incluyendo pérdidas
              relacionadas con Tareas no reconocidas por Monlix o con fallas
              del servicio Yape.
            </p>
            <p>
              Nada en esta sección limita los derechos irrenunciables que la
              normativa peruana de protección al consumidor reconoce al
              Usuario.
            </p>
          </Section>

          {/* Modificación */}
          <Section title="14. Modificación de estos Términos">
            <p>
              El Titular podrá modificar estos Términos en cualquier momento.
              Los cambios se comunicarán mediante su publicación en esta
              página, indicando la fecha de la última revisión. El uso
              continuado del Servicio tras la publicación de los cambios
              implica la aceptación de los Términos modificados.
            </p>
          </Section>

          {/* Ley aplicable */}
          <Section title="15. Ley aplicable, divisibilidad y reclamos">
            <p>
              Estos Términos se rigen por las leyes de la República del Perú.
              Para cualquier reclamo relacionado con el Servicio, puedes
              utilizar nuestro{" "}
              <Link href="/reclamaciones" className="underline">
                Libro de Reclamaciones Virtual
              </Link>
              , sin perjuicio de tu derecho a acudir a INDECOPI o a la
              autoridad competente.
            </p>
            <p>
              Si alguna disposición de estos Términos fuera declarada nula o
              inaplicable, las demás disposiciones conservarán su plena
              validez y eficacia.
            </p>
          </Section>

        <p className="mt-6 text-xs text-neutral-400">
          Ante cualquier duda sobre estos Términos, puede contactarnos en{" "}
          <a href="mailto:soporte@papunto.pe" className="underline">
            soporte@papunto.pe
          </a>
          . Consulte también nuestra{" "}
          <Link href="/privacidad" className="underline">
            Política de Privacidad
          </Link>{" "}
          y{" "}
          <Link href="/cookies" className="underline">
            Política de Cookies
          </Link>
          .
        </p>
    </LegalLayout>
  );
}
