// src/app/admin/(protected)/users/layout.tsx

import type { ReactNode } from "react";

import { authGuard } from "@/features/core/auth/services/server/authorization";

/**
 * ユーザー管理画面のレイアウト
 * admin ロールのみアクセス可能（editor は除外）
 */
export default async function UsersLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await authGuard({ allowRoles: ["admin"], redirectTo: "/admin" });

  return <>{children}</>;
}
