const SIZES = {
  sm: "h-8 w-8 text-xs",
  lg: "h-16 w-16 text-xl",
} as const;

function initial(name?: string | null, email?: string | null) {
  return (name?.trim() || email?.trim() || "?").charAt(0).toUpperCase();
}

/** Googleのプロフィール画像。未設定・読み込み失敗時は頭文字にフォールバックする */
export function Avatar({
  src,
  name,
  email,
  size = "sm",
}: {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: keyof typeof SIZES;
}) {
  const className = `flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-neutral-600 ${SIZES[size]}`;

  if (!src) {
    return <span className={className}>{initial(name, email)}</span>;
  }

  return (
    <span className={className}>
      {/* next/image を使うにはGoogleのCDNをremotePatternsに登録する必要があるため素のimgにする */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
    </span>
  );
}
