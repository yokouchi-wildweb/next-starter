// src/app/admin/insane/layout.tsx

import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { InsaneProtectedLayout } from "./_layout";
import { authGuard, hasAdminUser } from "@/features/core/auth/services/server/authorization";
import type { UserRoleType } from "@/features/core/user/types";

export default async function InsaneLayout({
  children,
}: Readonly<{ children: ReactNode }>) {

  const ROLE_ADMIN: UserRoleType = "admin";

  // 管理者ユーザー(ロール admin)が未作成の環境では、初期セットアップへリダイレクト
  // (layout はデータを取らないので、判定は authorization の hasAdminUser に任せる)
  if (!(await hasAdminUser([ROLE_ADMIN]))) redirect("/admin/setup");

  await authGuard({ allowRoles: ["admin"], redirectTo: "/admin/login", returnBack: true });

  return <InsaneProtectedLayout>{children}</InsaneProtectedLayout>;
}
