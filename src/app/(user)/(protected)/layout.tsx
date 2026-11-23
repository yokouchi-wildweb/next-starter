// src/app/(user)/(protected)/layout.tsx
//
// 方針は隣の guard.ts。

import type { ReactNode } from "react";

import { guard, guardMetadata } from "./guard";

// 先に守りを通してから metadata を返す(断られた訪問者の応答に配下のページの題名を出さない)
export const generateMetadata = guardMetadata();

export default async function UserProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await guard();

  return <>{children}</>;
}
