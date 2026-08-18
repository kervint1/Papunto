/**
 * 招待コードの受け渡し。
 *
 * `?ref=` はLPで受け取るが、その時点ではまだログインしていない。
 * Googleの往復を挟むので、**コードを保存しておいてログイン後に適用する**。
 * OAuthのstateに載せるより経路が単純で、ログイン方法が増えても壊れない。
 */
const KEY = "papunto.ref";

export function captureRefFromUrl(): void {
  if (typeof window === "undefined") return;
  const code = new URLSearchParams(window.location.search).get("ref");
  if (!code) return;
  try {
    // 既に保存済みなら上書きしない。先に踏んだリンクの招待元を優先する
    if (!window.localStorage.getItem(KEY)) {
      window.localStorage.setItem(KEY, code.trim().toUpperCase());
    }
  } catch {
    // プライベートモードなどで保存できないことがある。招待が付かないだけで
    // 登録自体は成立するので、握りつぶす
  }
}

/** 確認できたコードを保存する。ログイン後に ReferralClaimer が適用する */
export function saveRef(code: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, code.trim().toUpperCase());
  } catch {
    // 保存できなくても、ログイン後に手入力で復帰できる
  }
}

export function pendingRef(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearRef(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // 消せなくても、サーバー側が二重適用を拒否するので実害はない
  }
}

/**
 * 招待の状態が変わったことを画面に知らせる。
 *
 * リンク経由の自動適用（ReferralClaimer）と招待カードは別々に動くので、
 * 適用が終わったことをカードに伝えないと、**リンクが成功したのに
 * 「コードを入力してください」が出たまま**になる。
 */
export const CLAIMED_EVENT = "papunto:referral-claimed";

export function notifyClaimed(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CLAIMED_EVENT));
}
