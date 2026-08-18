import { redirect } from "next/navigation";

/** 旧URL。出回ったリンクを壊さないようリダイレクトで受ける */
export default function RecargaRedirect() {
  redirect("/canjear/recarga");
}
