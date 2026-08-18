import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
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
    /**
     * メールのマジックリンク。
     *
     * NextAuth の EmailProvider は使わない。あれはDBアダプタを要求するが、
     * ここは自前JWT＋FastAPIの構成なので噛み合わない。トークンの発行と
     * 検証はFastAPI側で完結させ、ここは**検証済みトークンを
     * セッションに変える**役だけを持つ。
     */
    CredentialsProvider({
      id: "magic-link",
      name: "Magic Link",
      credentials: { token: { type: "text" } },
      async authorize(credentials) {
        if (!credentials?.token) return null;

        const res = await fetch(`${apiUrl}/api/v1/auth/magic-link/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: credentials.token }),
        });
        if (!res.ok) return null;

        const data = await res.json();
        if (!data.access_token) return null;

        // id は NextAuth が要求する。apiToken を jwt コールバックへ渡す
        return { id: "magic-link", apiToken: data.access_token };
      },
    }),
  ],
  pages: {
    signIn: "/ingresar",
    // 失敗も /login に戻し、?error= で理由を出す（既定の /api/auth/error は素っ気ないため）
    error: "/ingresar",
  },
  callbacks: {
    async jwt({ token, account, user }) {
      // マジックリンク経由。authorize が返した apiToken をそのまま載せる
      if (user && "apiToken" in user) {
        token.apiToken = (user as { apiToken?: string }).apiToken;
        return token;
      }

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
