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

export default function CookiesPage() {
  return (
    <div className="min-h-screen w-full bg-neutral-50">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/">
          <Logo />
        </Link>

        <h1 className="mt-6">Política de Cookies</h1>
        <p className="mt-2 text-sm text-neutral-500">Última revisión: 26 de julio de 2026</p>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Esta política le ayudará a entender qué cookies y tecnologías de
          seguimiento utilizamos, cómo las utilizamos y qué derechos tiene
          usted al respecto.
        </p>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
          {/* Introducción */}
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">Introducción</h2>
            <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-neutral-600">
              <p>
                El presente documento informa a los Usuarios sobre las
                tecnologías que ayudan a esta Aplicación a lograr los fines
                descritos a continuación. Dichas tecnologías permiten al
                Titular acceder a información y almacenarla (por ejemplo,
                utilizando una Cookie) o emplear recursos (por ejemplo,
                ejecutando un script) en el dispositivo de un Usuario mientras
                este interactúa con esta Aplicación.
              </p>
              <p>
                Para simplificar, en el presente documento toda esta clase de
                tecnologías se define como &ldquo;Rastreadores&rdquo;, salvo
                que exista un motivo para diferenciarlas.
              </p>
              <p>
                Es posible que algunas de las finalidades para las que se
                utilizan Rastreadores exijan el consentimiento del Usuario.
                Siempre que se otorgue el consentimiento, este podrá revocarse
                libremente en cualquier momento siguiendo las instrucciones
                facilitadas en el presente documento.
              </p>
              <p>
                Esta Aplicación utiliza Rastreadores gestionados directamente
                por el Titular (Rastreadores &ldquo;de origen&rdquo;) y
                Rastreadores que hacen posibles servicios prestados por un
                tercero (Rastreadores &ldquo;de terceros&rdquo;). Los plazos de
                validez y expiración pueden variar dependiendo de la duración
                establecida por el Titular o el proveedor correspondiente;
                algunas expiran al finalizar la sesión de navegación del
                Usuario.
              </p>
            </div>
          </section>

          {/* Titular */}
          <Section title="Titular y Responsable del tratamiento de los Datos">
            <p>Papunto — 1 Gosho, Ichihara-shi, Chiba, Japón</p>
            <p>Correo electrónico de contacto del Titular: kervint1@gmail.com</p>
          </Section>

          {/* Cómo utiliza rastreadores */}
          <Section title="Cómo esta Aplicación utiliza Rastreadores">
            <p>
              Esta Aplicación utiliza Cookies denominadas &ldquo;técnicas&rdquo;
              y otros Rastreadores similares para llevar a cabo actividades que
              son estrictamente necesarias para el funcionamiento o la
              prestación del Servicio.
            </p>

            <SubSection title="Funcionalidad">
              <p>
                Esta Aplicación utiliza Rastreadores para hacer posibles
                interacciones y funcionalidades básicas, lo que permite a los
                Usuarios acceder a determinadas características del Servicio y
                facilita la comunicación con el Titular.
              </p>
              <p>
                <strong>Google OAuth</strong> — Google Ireland Limited
                (Irlanda). Servicio de registro y autenticación conectado a la
                red Google. Datos tratados: datos de uso, rastreadores y otros
                según la política de privacidad del servicio.
              </p>
              <p>
                <strong>Facebook Authentication</strong> — Meta Platforms, Inc.
                (EE.UU.). Servicio de registro y autenticación conectado a la
                red social Facebook. Duración de los rastreadores: <code>_fbp</code>{" "}
                (3 meses), <code>datr</code> (2 años), <code>fbsr_*</code> y{" "}
                <code>lastExternalReferrer</code> (duración de la sesión).
              </p>
            </SubSection>

            <SubSection title="Medición">
              <p>
                Esta Aplicación utiliza Rastreadores para medir el tráfico y
                analizar el comportamiento de los Usuarios con el fin de
                mejorar el Servicio.
              </p>
              <p>
                <strong>Google Analytics 4</strong> — Google Ireland Limited
                (Irlanda). Google utiliza los Datos recogidos para rastrear y
                examinar el uso de esta Aplicación, preparar informes y
                compartirlos con otros servicios de Google. Las direcciones IP
                se usan en el momento de la recogida y luego se descartan antes
                de registrarse en cualquier centro de datos. Duración de los
                rastreadores: <code>_ga</code> (2 años), <code>_ga_*</code> (2
                años).
              </p>
            </SubSection>
          </Section>

          {/* Gestionar preferencias */}
          <Section title="Cómo gestionar las preferencias">
            <SubSection title="Otorgar o revocar el consentimiento">
              <p>
                En cuanto a los Rastreadores de terceros, los Usuarios podrán
                gestionar sus preferencias a través del enlace de inhabilitación
                relacionado (cuando exista), utilizando los medios indicados en
                la política de privacidad del tercero o contactando con dicho
                tercero.
              </p>
            </SubSection>
            <SubSection title="Mediante la configuración del navegador o dispositivo">
              <p>Los Usuarios pueden emplear la configuración de su propio navegador para:</p>
              <ul className="list-disc pl-5">
                <li>Ver qué Cookies u otras tecnologías se han establecido en el dispositivo.</li>
                <li>Bloquear las Cookies o tecnologías similares.</li>
                <li>Eliminar las Cookies o tecnologías similares del navegador.</li>
              </ul>
              <p>
                La configuración del navegador no permite el control granular
                del consentimiento por categorías. En dispositivos móviles, los
                Usuarios también podrán gestionar determinadas categorías de
                Rastreadores a través de la configuración de publicidad o de
                rastreo del dispositivo.
              </p>
            </SubSection>
            <SubSection title="Consecuencias de no permitir el uso de Rastreadores">
              <p>
                Los Usuarios pueden decidir libremente si permitir o no el uso
                de Rastreadores. Sin embargo, los Rastreadores ayudan a esta
                Aplicación a proporcionar una mejor experiencia y
                funcionalidades avanzadas. Si el Usuario decide bloquear su
                uso, es posible que el Titular no pueda proporcionar las
                características relacionadas.
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
            <SubSection title="Usuario / Interesado">
              <p>
                El individuo que utiliza esta Aplicación, que coincide con la
                persona física a la que se refieren los Datos Personales, salvo
                que se indique lo contrario.
              </p>
            </SubSection>
            <SubSection title="Cookie">
              <p>
                Las Cookies son Rastreadores que consisten en pequeñas
                cantidades de datos almacenadas en el navegador del Usuario.
              </p>
            </SubSection>
            <SubSection title="Rastreador">
              <p>
                Cualquier tecnología (cookies, identificadores únicos, balizas
                web, scripts incrustados, etc.) que permite rastrear a los
                Usuarios, por ejemplo, accediendo a información o
                almacenándola en el dispositivo del Usuario.
              </p>
            </SubSection>
          </Section>
        </div>

        <p className="mt-6 text-xs text-neutral-400">
          Para más información sobre el tratamiento de sus datos, consulte
          nuestra{" "}
          <Link href="/privacidad" className="underline">
            Política de Privacidad
          </Link>
          . Ante cualquier duda, puede contactarnos en{" "}
          <a href="mailto:kervint1@gmail.com" className="underline">
            kervint1@gmail.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
