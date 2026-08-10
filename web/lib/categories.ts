/**
 * ブログのカテゴリ定義。
 *
 * ⚠️ pandia側の lib/site.ts の CATEGORIES と対になっている。
 *    片方だけ変えると、管理画面で選んだカテゴリにブログ側で入らなくなる。
 *
 * 記事のタグが canonical（またはpandia側のmatch）と一致すると、
 * ブログのトップページでそのカテゴリのセクションに並ぶ
 */
export const POST_CATEGORIES = [
  { id: "ahorro", label: "Ahorro y Dinero", canonical: "ahorro" },
  { id: "estilo-de-vida", label: "Estilo de Vida", canonical: "estilo de vida" },
  { id: "tech", label: "Tech y Apps", canonical: "tech" },
  { id: "tendencias", label: "Tendencias", canonical: "tendencias" },
] as const;

/** タグ一覧から、該当するカテゴリのidを返す（複数該当しうる） */
export function resolveCategories(tags: string[]): string[] {
  const lower = tags.map((t) => t.trim().toLowerCase());
  return POST_CATEGORIES.filter((c) => lower.includes(c.canonical)).map((c) => c.id);
}
