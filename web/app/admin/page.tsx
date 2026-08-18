"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getAdminStats, type AdminStats } from "@/lib/api";
import { Card, PageTitle, useAdminToken } from "./ui";

function Stat({
  label,
  value,
  href,
  hint,
  alert,
}: {
  label: string;
  value: string;
  href?: string;
  hint?: string;
  alert?: boolean;
}) {
  const body = (
    <Card className={`p-4 ${href ? "transition-colors hover:border-yellow-300" : ""}`}>
      <div className="text-xs text-neutral-500">{label}</div>
      <div
        className={`mt-1 tabular-nums ${alert ? "text-red-600" : "text-neutral-900"}`}
        style={{ fontSize: "1.75rem", lineHeight: 1.1 }}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-neutral-400">{hint}</div>}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function AdminDashboard() {
  const token = useAdminToken();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    if (!token) return;
    getAdminStats(token).then(setStats).catch(console.error);
  }, [token]);

  const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("es-PE"));

  return (
    <>
      <PageTitle title="Dashboard" sub="Estado general de la operación" />

      {/* 外部連携が開発用の設定のままかを常に見せる。
          契約前は mock/sandbox が正しい設定なので、値そのものを出して
          判断できるようにする。切り替え忘れはエラーにならないため */}
      {stats && (stats.cpalead_mock || stats.reloadly_sandbox) && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-medium">Integraciones en modo de prueba:</span>{" "}
          {[
            stats.cpalead_mock && "ofertas (CPALead mock)",
            stats.reloadly_sandbox && "recargas (Reloadly sandbox)",
          ]
            .filter(Boolean)
            .join(" · ")}
          <span className="ml-1 text-amber-700">
            — correcto antes de firmar. Cambiar al publicar el servicio.
          </span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Canjes por procesar"
          value={n(stats?.withdrawals_pending)}
          href="/admin/withdrawals"
          hint="Solicitudes de Yape en espera"
          alert={(stats?.withdrawals_pending ?? 0) > 0}
        />
        <Stat
          label="Reclamaciones pendientes"
          value={n(stats?.complaints_pendientes)}
          href="/admin/complaints"
          hint="Libro de reclamaciones"
          alert={(stats?.complaints_pendientes ?? 0) > 0}
        />
        <Stat
          label="Recargas en proceso"
          value={n(stats?.topups_processing)}
          href="/admin/topups"
          hint="Si se quedan atascadas, revisar Reloadly"
        />
        <Stat
          label="Postbacks rechazados (7d)"
          value={n(stats?.postback_logs_unverified_7d)}
          href="/admin/postback-logs"
          hint="Firma o IP no válida"
          alert={(stats?.postback_logs_unverified_7d ?? 0) > 0}
        />
      </div>

      <h2 className="mt-8 text-sm text-neutral-500">Cifras generales</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Usuarios" value={n(stats?.users_total)} href="/admin/users" />
        <Stat label="Nuevos (7 días)" value={n(stats?.users_new_7d)} />
        <Stat
          label="Puntos en circulación"
          value={n(stats?.points_outstanding)}
          hint="Lo que habría que pagar si todos canjearan"
        />
        <Stat
          label="Conversiones en revisión"
          value={n(stats?.postbacks_pending)}
          href="/admin/postbacks"
          hint="Aún no suman al saldo"
        />
      </div>
    </>
  );
}
