"use client";

import { useCallback, useEffect, useState } from "react";

import { PreRegistroView } from "@/components/PreRegistroView";
import { InviteCard } from "@/components/InviteCard";
import { InviteCodeEntry } from "@/components/InviteCodeEntry";
import { Header } from "@/components/Header";
import { Progress } from "@/components/ui/progress";
import { useMe } from "@/hooks/useMe";
import {
  getCampaignSlot,
  getCampaignStatus,
  getOffers,
  getReferral,
  type CampaignSlot,
  type CampaignStatus,
  type Offer,
  type ReferralMe,
} from "@/lib/api";
import { CLAIMED_EVENT } from "@/lib/referral";

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
  // 交換の開放日。進捗カードとキャンペーンカードの両方の文言に効く
  const [campaign, setCampaign] = useState<CampaignStatus | null>(null);

  const [referral, setReferral] = useState<ReferralMe | null>(null);
  const [slot, setSlot] = useState<CampaignSlot | null>(null);

  useEffect(() => {
    if (!token) return;
    getCampaignSlot(token).then(setSlot).catch(() => setSlot(null));
  }, [token]);

  useEffect(() => {
    getCampaignStatus().then(setCampaign).catch(() => setCampaign(null));
  }, []);

  const loadReferral = useCallback(() => {
    if (!token) return;
    getReferral(token).then(setReferral).catch(() => setReferral(null));
  }, [token]);

  useEffect(() => {
    loadReferral();
  }, [loadReferral]);

  // リンク経由の自動適用は別コンポーネントで走る。終わったら読み直さないと、
  // 適用済みなのに「コードを入力してください」が残ってしまう
  useEffect(() => {
    window.addEventListener(CLAIMED_EVENT, loadReferral);
    return () => window.removeEventListener(CLAIMED_EVENT, loadReferral);
  }, [loadReferral]);
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

  // 事前登録の期間中でも、管理者にはアプリ本体を見せる。
  // 開放前に中身を確認・検証する手段が無いと、10/1に初めて本番の画面を
  // 見ることになる
  const preRegistro = campaign && !campaign.withdrawals_open && !me?.is_admin;

  /**
   * 交換が開くまではアプリを見せない。
   *
   * ⚠️ 中にタスクが1件も無い期間に空のアプリを見せると「登録したのに
   *    何もない」になる。事前登録は待機リストなので、確認ページとして扱う。
   */
  if (preRegistro && slot) {
    return (
      <PreRegistroView
        token={token}
        status={campaign}
        slot={slot}
        referral={referral}
        points={points}
        onClaimed={loadReferral}
      />
    );
  }

  const minPoints = me?.min_withdrawal_points ?? 500;
  const remaining = Math.max(minPoints - points, 0);
  const progress = Math.min((points / minPoints) * 100, 100);

  return (
    <div className="min-h-screen w-full bg-neutral-50">
      <Header points={points} avatarUrl={me?.avatar_url} name={me?.name} email={me?.email} />

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {/* 管理者だけがここに来ている状態を明示する。無いと「一般ユーザーにも
            アプリが見えている」と勘違いして、空のタスク一覧をバグとして扱う */}
        {campaign && !campaign.withdrawals_open && me?.is_admin && (
          <div className="mb-4 rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-white">
            管理者として表示中。一般ユーザーには
            <strong className="font-semibold"> 事前登録の確認ページ </strong>
            が出ています。
          </div>
        )}

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
              {/* 開放前に「もう交換できます」と言わない。
                  サーバーは10/1まで交換を拒否するので、言うと必ず失敗する */}
              {remaining > 0
                ? `Te faltan ${remaining.toLocaleString("es-PE")} pts para retirar`
                : campaign && !campaign.withdrawals_open
                  ? "Ya tienes el mínimo. El canje se abre pronto"
                  : "¡Ya puedes retirar! Solicítalo desde tu billetera 🎉"}
            </p>
          </div>
        </div>

        {/* 招待コードの入力。招待された側が探す画面なので、
            「友達を招待して稼ごう」のカードより前に出す */}
        {referral?.can_claim && (
          <div className="mt-4">
            <InviteCodeEntry token={token} data={referral} onClaimed={loadReferral} />
          </div>
        )}

        {/* 招待。案件がまだ0件なので、いま画面上で唯一「やれること」になる */}
        <div className="mt-4">
          <InviteCard data={referral} />
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
              <div className="p-8 text-center">
                <p className="text-sm text-neutral-600">
                  Todavía no hay tareas disponibles.
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm text-neutral-400">
                  Estamos preparando el catálogo para Perú. Te avisaremos por
                  correo cuando estén listas.
                </p>
              </div>
            ) : (
              <OfferGrid offers={offers} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
