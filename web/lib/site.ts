/**
 * サイト全体のSEO定数。
 *
 * 本番ドメインが決まったら NEXT_PUBLIC_SITE_URL に設定する（Vercelの環境変数）。
 * canonical・OGP・sitemap の絶対URLがこの値から組み立てられるため、未設定のまま
 * 本番に出すと localhost を指すURLが検索エンジンに渡ってしまう。
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const SITE_NAME = "Papunto";

/** ペルー向けの単一言語（スペイン語）サービス。地域まで含めて明示する */
export const LOCALE = "es_PE";
export const LANG = "es-PE";

export const SITE_DESCRIPTION =
  "Gana puntos completando tareas sencillas como encuestas y registros, y cámbialos por dinero. Gratis y solo para Perú. En preparación: pronto abriremos.";
