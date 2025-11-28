// src/features/auth/components/AuthSessionContext.ts

import { createContext } from "react";

import type { SessionUser } from "@/features/core/auth/entities/session";

// 認証済みユーザーの情報とセッション更新処理をまとめた Context が扱う値の型定義。
export type AuthSessionValue = {
  // サーバーで検証済みのユーザー情報。未ログイン時は null。
  user: SessionUser | null;
  // user が存在するかどうかを即座に判定できる派生フラグ。
  isAuthenticated: boolean;
  // クライアントからセッション再検証を要求するための非同期処理。
  refreshSession: () => Promise<void>;
};

// アプリ全体で共有する認証 Context。サーバー側で初期値を与え、クライアントはここから参照する。
export const AuthSessionContext = createContext<AuthSessionValue>({
  user: null,
  isAuthenticated: false,
  refreshSession: async () => {
    // フェーズ4でクライアントサービスを呼び出す実装を追加予定。
  },
});
