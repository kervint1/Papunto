/**
 * LPのセクション。左に英語の小見出し、右に大見出しと本文の2カラム。
 *
 * カード（角丸ボックス）を使わない。白地・細いヘアライン・広い余白で組む。
 * 囲みを重ねると「テンプレートを埋めただけ」に見え、金銭を扱うサービスの
 * 信用を落とす。法務ページ（/campana）と同じ考え方。
 */
export function Section({
  kicker,
  title,
  id,
  children,
  compact = false,
}: {
  kicker: string;
  title: string;
  id?: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      id={id}
      className={`mx-auto w-full max-w-6xl px-6 sm:px-8 ${compact ? "pt-16 sm:pt-20" : "pt-20 sm:pt-28"}`}
    >
      <div className="grid gap-8 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] sm:gap-14">
        <div className="pt-1 font-mono text-xs uppercase tracking-[0.18em] text-neutral-400">
          {kicker}
        </div>
        <div className="max-w-[60ch]">
          <h2
            className="text-neutral-900"
            style={{
              fontSize: "clamp(1.75rem, 3.6vw, 2.75rem)",
              letterSpacing: "-0.035em",
              lineHeight: 1.12,
            }}
          >
            {title}
          </h2>
          {children}
        </div>
      </div>
    </section>
  );
}
