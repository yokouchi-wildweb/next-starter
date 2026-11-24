// src/app/(user)/(protected)/layout.tsx
//
// 方針は隣の guard.ts。守りは layout の頭で待たず、境界(Guard = Suspense + この範囲の loading)の内側で確かめてから
// 中身を描く(D76)。会員の枠は上の (user) の layout(殻に入る)、この範囲の中身は境界の内側

import type { ReactNode } from "react";

import { Guard, guardMetadata } from "./guard";
import UserProtectedLoading from "./loading";

// 先に守りを通してから metadata を返す(断られた訪問者の応答に配下のページの題名を出さない)
export const generateMetadata = guardMetadata();

export default function UserProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <Guard fallback={<UserProtectedLoading />}>{children}</Guard>;
}
