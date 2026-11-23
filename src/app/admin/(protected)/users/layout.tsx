// src/app/admin/(protected)/users/layout.tsx

import type { ReactNode } from "react";

import { guard, guardMetadata } from "./guard";

// 先に守りを通してから metadata を返す(この範囲で断られた訪問者に配下のページの題名を出さない)
export const generateMetadata = guardMetadata();

/**
 * ユーザー管理画面のレイアウト
 * admin ロールのみアクセス可能（editor は除外）。方針は隣の guard.ts
 */
export default async function UsersLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await guard();

  return <>{children}</>;
}
