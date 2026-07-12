// src/app/debug/layout.tsx
//
// 管理者カテゴリ + デバッガーロール限定のデバッグ領域（/debug/**）。
// この layout が一括でガードするため、配下にページを置くだけでアクセス制限がかかる
// （ページ側に個別のガードは不要）。
//
// debugger ロールはメンテナンスモードのバイパス対象（maintenance.config.ts の bypassRoles）
// のため、メンテナンス中でもこの領域に入って診断できる。

import type { ReactNode } from "react";

import { authGuard } from "@/features/core/auth/services/server/authorization";
import { getRolesByCategory } from "@/features/core/user/constants";

export default async function DebugLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // debugger は user カテゴリのロールのため、リダイレクト先は /admin/login ではなく /login
  await authGuard({
    allowRoles: [...getRolesByCategory("admin"), "debugger"],
    redirectTo: "/login",
    returnBack: true,
  });

  return <>{children}</>;
}
