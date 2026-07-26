import Link from "next/link";

import { Logo } from "@/components/Logo";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-neutral-100 pt-6">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-neutral-600">
        {children}
      </div>
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
      <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-neutral-600">
        {children}
      </div>
    </div>
  );
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen w-full bg-neutral-50">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/">
          <Logo />
        </Link>

        <h1 className="mt-6">Política de Privacidad</h1>
        <p className="mt-2 text-sm text-neutral-500">Última revisión: 26 de julio de 2026</p>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Esta política le ayudará a entender qué datos recogemos, por qué los
          recogemos y qué derechos tiene usted al respecto.
        </p>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
          {/* Resumen */}
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">Resumen</h2>

            <SubSection title="Datos que recogemos automáticamente">
              <p>
                Recogemos datos sobre usted automáticamente, por ejemplo, cuando
                visita Papunto: rastreadores, datos de uso, cantidad de usuarios
                y estadísticas de sesión. Terceros de confianza nos ayudan a
                tratarlos (registro y autenticación, estadísticas, contacto con
                el usuario).
              </p>
            </SubSection>

            <SubSection title="Datos que usted nos proporciona">
              <p>
                Recogemos los datos que nos proporciona, por ejemplo, cuando
                rellena un formulario: su dirección de correo electrónico.
                Terceros de confianza nos ayudan a tratarlos con el fin de
                contactar con usted.
              </p>
            </SubSection>
          </section>

          {/* Titular */}
          <Section title="Titular y Responsable del tratamiento de los Datos">
            <p>Papunto — 1 Gosho, Ichihara-shi, Chiba, Japón</p>
            <p>Correo electrónico de contacto del Titular: kervint1@gmail.com</p>
          </Section>

          {/* Tipos de Datos */}
          <Section title="Tipos de Datos que recogemos">
            <p>
              Entre las clases de Datos Personales que recoge esta Aplicación,
              ya sea directamente o a través de terceros, se encuentran:
            </p>
            <ul className="list-disc pl-5">
              <li>Rastreadores</li>
              <li>Datos de uso</li>
              <li>Cantidad de Usuarios</li>
              <li>Estadísticas de sesión</li>
              <li>Dirección de correo electrónico</li>
            </ul>
            <p>
              La información completa referente a cada categoría de Datos
              Personales se proporciona en las secciones de esta política
              dedicadas a tal fin. Salvo que se indique lo contrario, todos los
              Datos solicitados por esta Aplicación son obligatorios y la
              negativa a proporcionarlos podrá imposibilitar la prestación de
              sus servicios. Los Usuarios que tengan dudas sobre qué Datos son
              obligatorios pueden contactar con el Titular.
            </p>
            <p>
              El uso de Cookies u otras herramientas de seguimiento por parte de
              esta Aplicación tiene como finalidad la prestación del Servicio
              solicitado por el Usuario, además de otras finalidades descritas
              en este documento.
            </p>
            <p>
              El Usuario asume la responsabilidad respecto de los Datos
              Personales de terceros que se obtengan, publiquen o compartan a
              través de esta Aplicación.
            </p>
          </Section>

          {/* Modalidad y lugar */}
          <Section title="Modalidad y lugar del tratamiento de los Datos recogidos">
            <SubSection title="Modalidades de Tratamiento">
              <p>
                El Titular tratará los Datos de los Usuarios de manera adecuada
                y adoptará las medidas de seguridad apropiadas para impedir el
                acceso, la revelación, alteración o destrucción no autorizados
                de los Datos. El tratamiento se realizará mediante ordenadores
                y/o herramientas informáticas, siguiendo procedimientos
                estrictamente relacionados con las finalidades señaladas.
              </p>
            </SubSection>
            <SubSection title="Lugar">
              <p>
                Los Datos se tratan en las oficinas del Titular y en cualquier
                otro lugar en el que se encuentren las partes implicadas en el
                tratamiento. Dependiendo de la localización de los Usuarios, las
                transferencias de Datos pueden implicar la transferencia a otro
                país diferente al suyo.
              </p>
            </SubSection>
            <SubSection title="Período de conservación">
              <p>
                Salvo que se indique lo contrario, los Datos Personales serán
                tratados y conservados durante el tiempo necesario para la
                finalidad por la que fueron recogidos, y podrán conservarse
                durante más tiempo debido a una obligación legal o al
                consentimiento de los Usuarios.
              </p>
            </SubSection>
          </Section>

          {/* Finalidad */}
          <Section title="Finalidad del Tratamiento de los Datos recogidos">
            <p>
              Los Datos relativos al Usuario son recogidos para permitir al
              Titular prestar su Servicio, cumplir sus obligaciones legales,
              responder a solicitudes de ejecución, proteger sus derechos e
              intereses y detectar cualquier actividad maliciosa o fraudulenta,
              así como para las siguientes finalidades: registro y
              autenticación, estadísticas y contactar con el Usuario.
            </p>
          </Section>

          {/* Detalle */}
          <Section title="Información detallada del Tratamiento de los Datos Personales">
            <SubSection title="Contactar con el Usuario — Formulario de contacto">
              <p>
                Al completar el formulario de contacto con su información,
                autoriza a esta Aplicación a utilizar estos datos para responder
                a sus consultas. Datos tratados: datos de uso, dirección de
                correo electrónico.
              </p>
            </SubSection>

            <SubSection title="Estadísticas — Google Analytics 4">
              <p>
                Empresa: Google Ireland Limited (Irlanda). Google Analytics 4 es
                un servicio de análisis web que utiliza los Datos recogidos para
                rastrear y examinar el uso de esta Aplicación, preparar informes
                de sus actividades y compartirlos con otros servicios de Google.
                Google puede utilizar los Datos para contextualizar y
                personalizar anuncios de su propia red publicitaria. Las
                direcciones IP se usan en el momento de la recogida y luego se
                descartan antes de registrarse en cualquier centro de datos.
              </p>
              <p>Datos tratados: cantidad de usuarios, datos de uso, estadísticas de sesión, rastreadores.</p>
            </SubSection>

            <SubSection title="Registro y autenticación">
              <p>
                Al registrarse o autenticarse, el Usuario permite que esta
                Aplicación le identifique y le dé acceso a los servicios
                dedicados. Estos servicios pueden ser prestados por terceros.
              </p>
              <p>
                <strong>Google OAuth</strong> — Google Ireland Limited (Irlanda).
                Servicio de registro y autenticación conectado a la red Google.
                Datos tratados: datos de uso, rastreadores y otros según la
                política de privacidad del servicio.
              </p>
              <p>
                <strong>Facebook Authentication</strong> — Meta Platforms, Inc.
                (EE.UU.). Servicio de registro y autenticación conectado a la
                red social Facebook. Datos tratados: rastreadores y otros según
                la política de privacidad del servicio.
              </p>
            </SubSection>
          </Section>

          {/* Cookies */}
          <Section title="Política de Cookies">
            <p>
              Esta Aplicación utiliza Rastreadores. Para obtener más
              información, los Usuarios pueden consultar la{" "}
              <Link href="/cookies" className="underline">
                Política de Cookies
              </Link>
              .
            </p>
          </Section>

          {/* UE */}
          <Section title="Más información para los usuarios en la Unión Europea">
            <SubSection title="Base jurídica del Tratamiento">
              <p>El Titular podrá tratar los Datos Personales del Usuario si se cumple una de las siguientes condiciones:</p>
              <ul className="list-disc pl-5">
                <li>Cuando los Usuarios hayan dado su consentimiento para una o más finalidades específicas.</li>
                <li>Cuando la obtención de Datos sea necesaria para el cumplimiento de un contrato con el Usuario.</li>
                <li>Cuando el tratamiento sea necesario para el cumplimiento de una obligación legal.</li>
                <li>Cuando el tratamiento esté relacionado con una tarea de interés público.</li>
                <li>Cuando el tratamiento sea necesario para un interés legítimo del Titular o de un tercero.</li>
              </ul>
            </SubSection>

            <SubSection title="Los derechos de los Usuarios (RGPD)">
              <p>Los Usuarios tienen derecho a, en la medida en que lo permita la ley:</p>
              <ul className="list-disc pl-5">
                <li>Retirar su consentimiento en cualquier momento.</li>
                <li>Oponerse al tratamiento de sus Datos.</li>
                <li>Acceder a sus Datos y obtener una copia de los mismos.</li>
                <li>Verificar y solicitar la rectificación de sus Datos.</li>
                <li>Limitar el tratamiento de sus Datos.</li>
                <li>Borrar o eliminar sus Datos Personales.</li>
                <li>Recibir sus Datos y transferirlos a otro responsable (portabilidad).</li>
                <li>Presentar una reclamación ante la autoridad competente.</li>
              </ul>
            </SubSection>

            <SubSection title="Cómo ejercer estos derechos">
              <p>
                Cualquier solicitud puede dirigirse al Titular a través de los
                datos de contacto facilitados en este documento. Las
                solicitudes son gratuitas y el Titular responderá tan pronto
                como sea posible y siempre dentro del plazo de un mes.
              </p>
            </SubSection>
          </Section>

          {/* Adicional */}
          <Section title="Información adicional sobre la recogida de Datos y su tratamiento">
            <SubSection title="Defensa jurídica">
              <p>
                Los Datos Personales del Usuario podrán ser utilizados para la
                defensa jurídica del Titular ante un tribunal derivado del uso
                inapropiado de esta Aplicación. El Titular puede ser requerido
                por las autoridades públicas a revelar Datos Personales.
              </p>
            </SubSection>
            <SubSection title="Log del sistema y mantenimiento">
              <p>
                Por motivos de funcionamiento y mantenimiento, esta Aplicación
                podrá recoger un registro del sistema que puede contener Datos
                Personales, tales como la dirección IP del Usuario.
              </p>
            </SubSection>
            <SubSection title="Modificación de la presente política de privacidad">
              <p>
                El Titular se reserva el derecho de modificar esta política en
                cualquier momento, notificándolo a los Usuarios a través de esta
                página. Se recomienda revisar esta página con frecuencia,
                tomando como referencia la fecha de la última actualización.
              </p>
            </SubSection>
          </Section>

          {/* Definiciones */}
          <Section title="Definiciones y referencias legales">
            <SubSection title="Datos Personales (o Datos)">
              <p>
                Cualquier información que, directa o indirectamente, permita
                identificar a una persona física.
              </p>
            </SubSection>
            <SubSection title="Datos de Uso">
              <p>
                Información recogida automáticamente por esta Aplicación (o por
                servicios de terceros): direcciones IP o nombres de dominio,
                URIs, hora de la solicitud, método utilizado, tamaño del
                archivo de respuesta, código de estado del servidor, país de
                origen, características del navegador y sistema operativo,
                coordenadas temporales de la visita y detalles del itinerario
                seguido dentro de la Aplicación.
              </p>
            </SubSection>
            <SubSection title="Usuario / Interesado">
              <p>
                El individuo que utiliza esta Aplicación, que coincide con la
                persona física a la que se refieren los Datos Personales, salvo
                que se indique lo contrario.
              </p>
            </SubSection>
            <SubSection title="Encargado y Responsable del Tratamiento">
              <p>
                El Responsable del Tratamiento (Titular) es quien determina las
                finalidades y medidas del tratamiento de los Datos Personales.
                El Encargado del Tratamiento procesa los Datos en nombre del
                Responsable.
              </p>
            </SubSection>
            <SubSection title="Cookie / Rastreador">
              <p>
                Las Cookies son Rastreadores que consisten en pequeñas
                cantidades de datos almacenadas en el navegador del Usuario. Un
                Rastreador designa cualquier tecnología (cookies, identificadores
                únicos, balizas web, scripts incrustados, etc.) que permite
                rastrear a los Usuarios.
              </p>
            </SubSection>
          </Section>
        </div>

        <p className="mt-6 text-xs text-neutral-400">
          Ante cualquier duda sobre esta política, puede contactarnos en{" "}
          <a href="mailto:kervint1@gmail.com" className="underline">
            kervint1@gmail.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
