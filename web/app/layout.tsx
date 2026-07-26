import type { Metadata } from "next";

import { Footer } from "@/components/Footer";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Papunto",
  description: "Completa tareas y recibe dinero al instante en tu Yape",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="flex min-h-screen flex-col">
        <Providers>
          <div className="flex-1">{children}</div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
