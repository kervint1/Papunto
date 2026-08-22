import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Consentimiento de cookies",
  description: "Gestiona tu consentimiento para el uso de cookies en Papunto.",
  alternates: { canonical: "/consentimiento-cookies" },
};

import { LegalLayout } from "@/components/LegalLayout";

export default function ConsentimientoCookiesPage() {
  return (
    <LegalLayout
      title="Consentimiento para el uso de cookies"
      updated="26 de julio de 2026"
      current="/consentimiento-cookies"
    >
      <div className="flex flex-col gap-5">
          <p>
            <strong>1.</strong> Papunto utiliza cookies para mejorar la
            experiencia de los Usuarios.
          </p>

          <div>
            <p>
              <strong>2.</strong> Por medio de cookies, Papunto podrá recabar
              la siguiente información:
            </p>

            <div className="mt-3 ml-4 flex flex-col gap-3">
              <p>
                <strong>Cookies necesarias:</strong> son importantes dado que
                te permiten navegar en nuestro Sitio, te dan acceso seguro a
                zonas con información personal (como tu cuenta y tus puntos) y
                protegen tanto al Usuario como al Sitio de posibles
                falsificaciones y usos indebidos. En Papunto, estas cookies
                corresponden al inicio de sesión con Google (Google OAuth). El
                detalle se encuentra en nuestra{" "}
                <Link href="/cookies" className="underline">
                  Política de Cookies
                </Link>
                .
              </p>
              <p>
                <strong>Cookies no necesarias:</strong> nos permiten realizar
                funcionalidades que no son indispensables para el
                funcionamiento del Sitio, como analizar el comportamiento y
                los hábitos de navegación de los Usuarios con el fin de
                mejorar el Servicio. En Papunto, estas cookies corresponden a
                Google Analytics 4. Solo recopilamos cookies no necesarias en
                caso nos brindes previa y libremente tu consentimiento.
              </p>
            </div>
          </div>

          <p>
            Nos autorizas a utilizar las cookies que hayas aceptado, de
            acuerdo con tus preferencias. El detalle de las funcionalidades de
            cada cookie está disponible en nuestra{" "}
            <Link href="/cookies" className="underline">
              Política de Cookies
            </Link>
            .
          </p>

          <p>
            <strong>3.</strong> En el caso de Google Analytics 4, autorizas a
            que Google Ireland Limited procese los datos recogidos para
            preparar informes de uso de esta Aplicación y, según su propia
            política, para contextualizar y personalizar anuncios de su red
            de publicidad. Papunto no realiza publicidad comercial propia con
            base en tu comportamiento de navegación.
          </p>

          <p>
            <strong>4.</strong> La aceptación o denegación de esta
            autorización no condiciona la prestación del servicio que estás
            solicitando ni tu navegación por el Sitio.
          </p>

          <div>
            <p>
              <strong>5.</strong> En cualquier momento podrás ejercer tu
              derecho de desactivación o eliminación de cookies de este
              Sitio. Estas acciones se realizan de forma diferente según el
              navegador que estés usando:
            </p>
            <ul className="mt-3 ml-4 list-disc pl-5">
              <li>
                <strong>Internet Explorer:</strong> Herramientas &gt; Opciones
                de Internet &gt; Privacidad &gt; Configuración.
              </li>
              <li>
                <strong>Mozilla Firefox:</strong> Herramientas &gt; Opciones
                &gt; Privacidad &gt; Historial &gt; Configuración
                Personalizada.
              </li>
              <li>
                <strong>Google Chrome:</strong> Configuración &gt; Mostrar
                opciones avanzadas &gt; Privacidad &gt; Configuración de
                contenido.
              </li>
              <li>
                <strong>Safari:</strong> Preferencias &gt; Seguridad.
              </li>
            </ul>
            <p className="mt-2">
              Para más información, puedes consultar el soporte oficial de tu
              navegador.
            </p>
          </div>

          <p>
            <strong>6.</strong> Tienes la potestad de permitir, bloquear o
            eliminar estas cookies cuando lo creas conveniente, a través de la
            configuración de tu dispositivo y de tu navegador. La
            desactivación de las cookies no impide la navegación por el
            Sitio, aunque el uso de algunos servicios (como iniciar sesión)
            podrá verse limitado.
          </p>

          <p>
            <strong>7.</strong> Al tratamiento de tu información autorizado a
            través del presente consentimiento le resultan aplicables las
            condiciones mencionadas en nuestra{" "}
            <Link href="/cookies" className="underline">
              Política de Cookies
            </Link>{" "}
            y nuestra{" "}
            <Link href="/privacidad" className="underline">
              Política de Privacidad
            </Link>
            .
          </p>
        </div>

      <p className="mt-10 text-xs text-neutral-400">
        Ante cualquier duda sobre este consentimiento, puede contactarnos en{" "}
        <a href="mailto:info@papunto.pe" className="underline">
          info@papunto.pe
        </a>
        .
      </p>
    </LegalLayout>
  );
}
