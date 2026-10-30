// src/app/(user)/(protected)/layout.tsx
//
// 方針は隣の guard.ts。

import type { ReactNode } from "react";

import { guard } from "./guard";

export default async function UserProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await guard();

  return <>{children}</>;
}
