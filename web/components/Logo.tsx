/**
 * Papunto のロゴ。
 *
 * 「punto」はスペイン語で点。ブランド名の意味そのものなので、
 * 黄色を**ドット**に使う。意味のある形にすることで、
 * 汎用テンプレートに見えるのを避ける。
 *
 * ⚠️ 黄色を文字色に使わないこと。白背景でコントラストが足りず読めない
 *    （Pandiaの青は成立するが、黄色では成立しない）。
 */
export function Logo({
  className = "",
  /** アイコンを出さず、文字だけにする（法務ページなど、装飾を抑えたい場所） */
  wordmarkOnly = false,
}: {
  className?: string;
  wordmarkOnly?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!wordmarkOnly && (
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400 text-lg font-semibold text-neutral-900">
          P
        </span>
      )}
      <span className="inline-flex items-baseline gap-1 text-xl tracking-tight text-neutral-900">
        Papunto
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
      </span>
    </div>
  );
}
