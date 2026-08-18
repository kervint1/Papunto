import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// サーバー側（NextAuthコールバック内）からFastAPIを呼ぶときのURL。
// Docker内ではコンテナ間通信のため API_URL_INTERNAL (http://server:8000) を使う
const apiUrl =
  process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/ingresar",
    // 失敗も /login に戻し、?error= で理由を出す（既定の /api/auth/error は素っ気ないため）
    error: "/ingresar",
  },
  callbacks: {
    async jwt({ token, account }) {
      // 初回サインイン時: GoogleのIDトークンをFastAPIに渡し、自前JWTを受け取る。
      // 2回目以降のjwtコールバックでは account が無く、token.apiToken が引き継がれる
      if (!account?.id_token) return token;

      // ここで失敗を握りつぶすと「ログインは成功したのにAPIを一度も呼べない」
      // セッションが残り、再ログインするまで永久に直らない。
      // 例外を投げてサインイン自体を失敗させ、ユーザーにやり直させる
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let res: Response;
      try {
        res = await fetch(`${apiUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_token: account.id_token }),
          signal: controller.signal,
        });
      } catch (err) {
        console.error("auth/login request error", err);
        throw new Error("BackendUnavailable");
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) {
        console.error("auth/login failed", res.status, await res.text());
        throw new Error("BackendRejected");
      }

      const data = await res.json();
      if (!data.access_token) {
        console.error("auth/login returned no access_token");
        throw new Error("BackendRejected");
      }
      token.apiToken = data.access_token;
      return token;
    },
    async session({ session, token }) {
      session.apiToken = token.apiToken as string | undefined;
      return session;
    },
  },
};
