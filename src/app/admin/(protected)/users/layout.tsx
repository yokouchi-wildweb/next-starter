// src/app/admin/(protected)/users/layout.tsx

import type { ReactNode } from "react";

import { Guard, guardMetadata } from "./guard";
import AdminUsersLoading from "./loading";

// 先に守りを通してから metadata を返す(この範囲で断られた訪問者に配下のページの題名を出さない)
export const generateMetadata = guardMetadata();

/**
 * ユーザー管理画面のレイアウト
 * admin ロールのみアクセス可能（editor は除外）。方針は隣の guard.ts。
 * 守りは layout の頭で待たず、境界(Guard = Suspense + この範囲の loading)の内側で確かめてから中身を描く(D76)
 */
export default function UsersLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <Guard fallback={<AdminUsersLoading />}>{children}</Guard>;
}
