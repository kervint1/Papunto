import { redirect } from "next/navigation";

/**
 * ルートをスペイン語に統一した際の旧URL。
 * 出回ったリンクを壊さないようリダイレクトで受ける（/wallet と同じ扱い）。
 */
export default function HomeRedirect() {
  redirect("/tareas");
}
