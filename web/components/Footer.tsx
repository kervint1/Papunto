import Link from "next/link";
import { Facebook, Instagram, Linkedin, Twitter } from "lucide-react";

const SNS = [
  { icon: Facebook, label: "Facebook" },
  { icon: Instagram, label: "Instagram" },
  { icon: Twitter, label: "Twitter" },
  { icon: Linkedin, label: "LinkedIn" },
];

const LEGAL_LINKS = [
  { label: "Libro de reclamaciones", href: "/reclamaciones" },
  { label: "Términos de uso", href: "/terminos" },
  { label: "Política de privacidad y datos personales", href: "/privacidad" },
  { label: "Política de cookies", href: "/cookies" },
  { label: "Consentimiento de uso de cookies", href: "/consentimiento-cookies" },
];

export function Footer() {
  return (
    <footer className="w-full bg-yellow-400">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        {/* SNS icons */}
        <div className="flex items-center gap-3">
          {SNS.map(({ icon: Icon, label }) => (
            <a
              key={label}
              href="#"
              aria-label={label}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white transition-colors hover:bg-neutral-700"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>

        {/* Copyright */}
        <p className="mt-6 text-sm text-neutral-800">
          Papunto © 2026. Todos los derechos reservados.
        </p>

        {/* Legal links */}
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {LEGAL_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="text-xs text-neutral-700 underline-offset-2 hover:underline"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
