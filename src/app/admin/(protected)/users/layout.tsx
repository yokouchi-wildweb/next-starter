// src/app/admin/(protected)/users/layout.tsx

import type { ReactNode } from "react";

import { Guard, guardMetadata } from "./guard";
import { ScreenWait } from "@/app/_layout/ScreenWait";

// 先に守りを通してから metadata を返す(この範囲で断られた訪問者に配下のページの題名を出さない)
export const generateMetadata = guardMetadata();

/**
 * ユーザー管理画面のレイアウト
 * admin ロールのみアクセス可能（editor は除外）。方針は隣の guard.ts。
 * 守りは layout の頭で待たず、境界(Guard = Suspense + 待つ間の既定 ScreenWait)の内側で確かめてから子の入口を描く(D76。ページの中身と題名は createScreen が load の後にだけ出す、D105)
 */
export default function UsersLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <Guard fallback={<ScreenWait />}>{children}</Guard>;
}
