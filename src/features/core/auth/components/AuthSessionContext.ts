// src/features/auth/components/AuthSessionContext.ts

import { createContext } from "react";

import type { SessionUser } from "@/features/core/auth/entities/session";

// useAuthSession が返す値の型(認証済みユーザーの情報とセッション更新処理)。
export type AuthSessionValue = {
  // サーバーで検証済みのユーザー情報。未ログイン時は null。
  user: SessionUser | null;
  // user が存在するかどうかを即座に判定できる派生フラグ。
  isAuthenticated: boolean;
  // クライアントからセッション再検証を要求するための非同期処理。
  refreshSession: () => Promise<void>;
};

// Context が運ぶ値(読み手は useAuthSession を通して読む)。
// - userPromise: サーバーが渡したセッションの利用者の promise(解けた値が null = 未ログイン)。読み手が use() で読む
// - override: refreshSession が決めた利用者。あれば Provider の寿命の間 userPromise より優先する
//   (ログイン・ログアウトの直後に、進行中の古い promise の値へ戻らない)
export type AuthSessionSource = {
  userPromise: Promise<SessionUser | null>;
  override?: { user: SessionUser | null };
  refreshSession: () => Promise<void>;
};

// アプリ全体で共有する認証 Context。Provider の外は未ログイン(override で読むので止まらない)。
export const AuthSessionContext = createContext<AuthSessionSource>({
  userPromise: Promise.resolve(null),
  override: { user: null },
  refreshSession: async () => {},
});
