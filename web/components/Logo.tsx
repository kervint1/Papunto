/**
 * Papunto のロゴ。**文字そのものがロゴ**なので、四角いマークは付けない。
 *
 * 「punto」はスペイン語で点。ブランド名の意味そのものなので、
 * 黄色を**ドット**に使う。意味のある形にすることで、
 * 汎用テンプレートに見えるのを避ける。
 *
 * ⚠️ 黄色を文字色に使わないこと。白背景でコントラストが足りず読めない
 *    （Pandiaの青は成立するが、黄色では成立しない）。
 *
 * 四角に P を入れたマークは、ファビコンとアプリアイコン専用
 * （`app/icon.tsx` / `app/opengraph-image.tsx`）。小さい枠で名前を出せない
 * 場所のための代替であって、ページ内では使わない。
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-baseline gap-1 text-xl tracking-tight text-neutral-900 ${className}`}
    >
      Papunto
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
    </span>
  );
}
