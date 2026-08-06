import { redirect } from "next/navigation";

/**
 * ポイント残高と履歴（通帳）はアカウント画面 /cuenta に統合した。
 * 同じ内容を2画面に置くと導線が分かれてしまうため、旧URLはリダイレクトで受ける。
 */
export default function WalletPage() {
  redirect("/cuenta");
}
