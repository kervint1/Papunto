"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, createComplaint, type ComplaintInput } from "@/lib/api";

type FormState = {
  tipo: "reclamo" | "queja";
  consumidor_nombre: string;
  consumidor_domicilio: string;
  consumidor_documento_tipo: "DNI" | "CE" | "Pasaporte";
  consumidor_documento_numero: string;
  consumidor_telefono: string;
  consumidor_email: string;
  es_menor_edad: boolean;
  apoderado_nombre: string;
  bien_tipo: "producto" | "servicio";
  bien_descripcion: string;
  monto_reclamado: string;
  detalle: string;
  pedido: string;
  declaracion: boolean;
};

const INITIAL_STATE: FormState = {
  tipo: "reclamo",
  consumidor_nombre: "",
  consumidor_domicilio: "",
  consumidor_documento_tipo: "DNI",
  consumidor_documento_numero: "",
  consumidor_telefono: "",
  consumidor_email: "",
  es_menor_edad: false,
  apoderado_nombre: "",
  bien_tipo: "servicio",
  bien_descripcion: "",
  monto_reclamado: "",
  detalle: "",
  pedido: "",
  declaracion: false,
};

export default function ReclamacionesPage() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ number: number; message: string } | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canSubmit =
    form.declaracion &&
    form.consumidor_nombre &&
    form.consumidor_domicilio &&
    form.consumidor_documento_numero &&
    form.consumidor_email &&
    form.bien_descripcion &&
    form.detalle &&
    form.pedido &&
    (!form.es_menor_edad || form.apoderado_nombre);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const body: ComplaintInput = {
        tipo: form.tipo,
        consumidor_nombre: form.consumidor_nombre,
        consumidor_domicilio: form.consumidor_domicilio,
        consumidor_documento_tipo: form.consumidor_documento_tipo,
        consumidor_documento_numero: form.consumidor_documento_numero,
        consumidor_telefono: form.consumidor_telefono || undefined,
        consumidor_email: form.consumidor_email,
        es_menor_edad: form.es_menor_edad,
        apoderado_nombre: form.es_menor_edad ? form.apoderado_nombre : undefined,
        bien_tipo: form.bien_tipo,
        bien_descripcion: form.bien_descripcion,
        monto_reclamado: form.monto_reclamado ? Number(form.monto_reclamado) : undefined,
        detalle: form.detalle,
        pedido: form.pedido,
      };
      const res = await createComplaint(body);
      setResult({ number: res.number, message: res.message });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error inesperado. Intenta nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen w-full bg-neutral-50">
        <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="mt-6">Reclamo N° {result.number} registrado</h1>
          <p className="mt-2 text-neutral-600">{result.message}</p>
          <Link href="/" className="mt-8 text-sm text-neutral-500 underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-neutral-50">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/">
          <Logo />
        </Link>

        <h1 className="mt-6">Libro de Reclamaciones Virtual</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Conforme al Código de Protección y Defensa del Consumidor (Ley N° 29571) y su
          reglamento (D.S. N° 011-2011-PCM, modificado por D.S. N° 101-2022-PCM). La
          formulación del reclamo o queja no impide acudir a otras vías de solución de
          controversias ni es requisito previo para interponer una denuncia ante el
          INDECOPI. El proveedor debe dar respuesta en un plazo no mayor a{" "}
          <strong>15 días hábiles, improrrogables</strong>.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
          {/* Tipo */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <Label>Tipo de solicitud</Label>
            <div className="mt-3 flex gap-3">
              {(["reclamo", "queja"] as const).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => update("tipo", tipo)}
                  className={`flex-1 rounded-xl border px-4 py-3 text-sm capitalize transition-colors ${
                    form.tipo === tipo
                      ? "border-yellow-400 bg-yellow-50 text-neutral-900"
                      : "border-neutral-200 text-neutral-500"
                  }`}
                >
                  {tipo}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              <strong>Reclamo</strong>: disconformidad relacionada a los productos o
              servicios. <strong>Queja</strong>: disconformidad no relacionada a los
              productos o servicios; o malestar respecto a la atención al público.
            </p>
          </div>

          {/* Datos del consumidor */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h3>Datos del consumidor reclamante</h3>
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="nombre">Nombre completo</Label>
                <Input
                  id="nombre"
                  value={form.consumidor_nombre}
                  onChange={(e) => update("consumidor_nombre", e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="domicilio">Domicilio</Label>
                <Input
                  id="domicilio"
                  value={form.consumidor_domicilio}
                  onChange={(e) => update("consumidor_domicilio", e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="doc-tipo">Tipo de documento</Label>
                  <select
                    id="doc-tipo"
                    value={form.consumidor_documento_tipo}
                    onChange={(e) =>
                      update(
                        "consumidor_documento_tipo",
                        e.target.value as FormState["consumidor_documento_tipo"]
                      )
                    }
                    className="h-9 rounded-md border border-input bg-input-background px-3 text-sm"
                  >
                    <option value="DNI">DNI</option>
                    <option value="CE">Carné de Extranjería</option>
                    <option value="Pasaporte">Pasaporte</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="doc-numero">N° de documento</Label>
                  <Input
                    id="doc-numero"
                    value={form.consumidor_documento_numero}
                    onChange={(e) => update("consumidor_documento_numero", e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="telefono">Teléfono (opcional)</Label>
                  <Input
                    id="telefono"
                    value={form.consumidor_telefono}
                    onChange={(e) => update("consumidor_telefono", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.consumidor_email}
                    onChange={(e) => update("consumidor_email", e.target.value)}
                    required
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={form.es_menor_edad}
                  onChange={(e) => update("es_menor_edad", e.target.checked)}
                />
                El consumidor es menor de edad
              </label>
              {form.es_menor_edad && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="apoderado">Nombre del padre, madre o apoderado</Label>
                  <Input
                    id="apoderado"
                    value={form.apoderado_nombre}
                    onChange={(e) => update("apoderado_nombre", e.target.value)}
                    required
                  />
                </div>
              )}
            </div>
          </div>

          {/* Datos del bien contratado */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h3>Datos del bien contratado</h3>
            <div className="mt-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bien-tipo">Tipo</Label>
                  <select
                    id="bien-tipo"
                    value={form.bien_tipo}
                    onChange={(e) =>
                      update("bien_tipo", e.target.value as FormState["bien_tipo"])
                    }
                    className="h-9 rounded-md border border-input bg-input-background px-3 text-sm"
                  >
                    <option value="producto">Producto</option>
                    <option value="servicio">Servicio</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="monto">Monto reclamado S/ (opcional)</Label>
                  <Input
                    id="monto"
                    inputMode="decimal"
                    value={form.monto_reclamado}
                    onChange={(e) => update("monto_reclamado", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bien-descripcion">Descripción</Label>
                <Input
                  id="bien-descripcion"
                  value={form.bien_descripcion}
                  onChange={(e) => update("bien_descripcion", e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Detalle y pedido */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="detalle">Detalle de la reclamación</Label>
                <Textarea
                  id="detalle"
                  value={form.detalle}
                  onChange={(e) => update("detalle", e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pedido">Pedido del consumidor</Label>
                <Textarea
                  id="pedido"
                  placeholder="Detalle exactamente lo que solicita"
                  value={form.pedido}
                  onChange={(e) => update("pedido", e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.declaracion}
              onChange={(e) => update("declaracion", e.target.checked)}
            />
            Declaro que la información consignada en este formulario es verdadera.
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={!canSubmit || submitting}
            className="h-12 w-full bg-yellow-400 text-neutral-900 hover:bg-yellow-300 disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            {submitting ? "Enviando..." : "Enviar reclamación"}
          </Button>
        </form>
      </div>
    </div>
  );
}
