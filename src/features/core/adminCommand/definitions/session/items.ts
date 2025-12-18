// src/features/core/adminCommand/definitions/session/items.ts

import type { ReactNode } from "react";

/**
 * セッション管理項目の定義
 */
export type SessionItem = {
  /** 一意識別子 */
  id: string;
  /** 表示ラベル */
  label: string;
  /** 説明文 */
  description?: string;
  /** アイコン */
  icon?: ReactNode;
  /** キーワード（検索用） */
  keywords?: string[];
};

/**
 * セッション管理の項目一覧
 */
export const sessionItems: SessionItem[] = [
  {
    id: "session-refresh",
    label: "リフレッシュ (refresh)",
    description: "ログイン状態を維持したままセッションを更新",
    keywords: ["refresh", "リフレッシュ", "更新"],
  },
  {
    id: "session-logout",
    label: "ログアウト (logout)",
    description: "ログアウトしてトップページへ",
    keywords: ["logout", "ログアウト", "サインアウト"],
  },
];
