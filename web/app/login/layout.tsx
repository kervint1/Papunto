import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Entra con tu cuenta de Google y empieza a ganar puntos en Papunto. Gratis y solo para Perú.",
  alternates: { canonical: "/login" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
