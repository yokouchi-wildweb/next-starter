// src/app/admin/(protected)/users/layout.tsx

import type { ReactNode } from "react";

import { guard } from "./guard";

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
