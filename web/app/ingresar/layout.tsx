import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Entra con tu correo, Google o Facebook y empieza a ganar puntos en Papunto. Gratis y sin tarjeta.",
  alternates: { canonical: "/ingresar" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
