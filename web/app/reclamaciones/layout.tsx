import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Libro de Reclamaciones",
  description: "Registra tu reclamo o queja en el Libro de Reclamaciones Virtual de Papunto, conforme al DS N° 101-2022-PCM de Indecopi.",
  alternates: { canonical: "/reclamaciones" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
