"use client";

import { useCallback, useEffect, useState } from "react";

import { Header } from "@/components/Header";
import { Progress } from "@/components/ui/progress";
import { useMe } from "@/hooks/useMe";
import { getOffers, type Offer } from "@/lib/api";

const MONLIX_IFRAME_URL = process.env.NEXT_PUBLIC_MONLIX_IFRAME_URL;

function OfferGrid({ offers }: { offers: Offer[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3 p-6">
      {offers.map((offer) => (
        <a
          key={offer.campaign_id}
          href={offer.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-200 p-4 text-center transition hover:border-yellow-400 hover:shadow-sm"
        >
          {offer.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={offer.image_url}
              alt=""
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-yellow-100" />
          )}
          <div className="text-sm text-neutral-900">{offer.title}</div>
          {offer.conversion && (
            <div className="text-xs text-neutral-500">{offer.conversion}</div>
          )}
          <span className="text-xs text-yellow-600">
            +{offer.points.toLocaleString("es-PE")} pts
          </span>
        </a>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { me, token, refresh } = useMe();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersError, setOffersError] = useState(false);
  const [loadingOffers, setLoadingOffers] = useState(true);

  const useIframe = Boolean(MONLIX_IFRAME_URL && me);

  useEffect(() => {
    if (!token || useIframe) return;
    setLoadingOffers(true);
    getOffers(token)
      .then((r) => {
        setOffers(r.offers);
        setOffersError(false);
      })
      .catch(() => setOffersError(true))
      .finally(() => setLoadingOffers(false));
  }, [token, useIframe]);

  // 案件は別タブで開くため、戻ってきたタイミングで残高を取り直す
  const onVisible = useCallback(() => {
    if (document.visibilityState === "visible") refresh();
  }, [refresh]);

  useEffect(() => {
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [onVisible]);

  const points = me?.points ?? 0;
  const minPoints = me?.min_withdrawal_points ?? 500;
  const remaining = Math.max(minPoints - points, 0);
  const progress = Math.min((points / minPoints) * 100, 100);

  return (
    <div className="min-h-screen w-full bg-neutral-50">
      <Header points={points} avatarUrl={me?.avatar_url} name={me?.name} email={me?.email} />

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Points / progress card */}
        <div className="rounded-3xl bg-yellow-400 p-6 sm:p-8">
          <p className="text-sm text-neutral-800">Tus puntos</p>
          <div className="mt-1" style={{ fontSize: "2.25rem", lineHeight: 1 }}>
            {points.toLocaleString("es-PE")} pts
          </div>

          <div className="mt-5 rounded-2xl bg-white/50 p-4">
            <div className="flex items-center justify-between text-sm text-neutral-800">
              <span>Mínimo para retirar</span>
              <span>{minPoints.toLocaleString("es-PE")} pts</span>
            </div>
            <Progress
              value={progress}
              className="mt-2 h-3 bg-white [&>[data-slot=progress-indicator]]:bg-neutral-900"
            />
            <p className="mt-2 text-xs text-neutral-700">
              {remaining > 0
                ? `Te faltan ${remaining.toLocaleString("es-PE")} pts para retirar`
                : "¡Ya puedes retirar! Solicítalo desde tu billetera 🎉"}
            </p>
          </div>
        </div>

        {/* Tareas: Monlix las sirve en un iframe; con CPALead pintamos la lista nosotros */}
        <div className="mt-8">
          <h2>Tareas con recompensa</h2>
          <div className="mt-4 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
            {useIframe ? (
              <iframe
                src={`${MONLIX_IFRAME_URL}&subid=${me!.id}`}
                className="h-[70vh] w-full border-0"
                title="Tareas"
              />
            ) : loadingOffers ? (
              <p className="p-6 text-center text-sm text-neutral-400">
                Cargando tareas...
              </p>
            ) : offersError ? (
              <p className="p-6 text-center text-sm text-neutral-400">
                No pudimos cargar las tareas. Inténtalo de nuevo más tarde.
              </p>
            ) : offers.length === 0 ? (
              <p className="p-6 text-center text-sm text-neutral-400">
                No hay tareas disponibles en este momento.
              </p>
            ) : (
              <OfferGrid offers={offers} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
