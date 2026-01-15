// src/app/admin/insane/layout.tsx

import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { InsaneProtectedLayout } from "@/components/AppFrames/Admin/Insane";
import { authGuard } from "@/features/core/auth/services/server/authorization";
import { userService } from "@/features/core/user/services/server/userService";
import type { UserRoleType } from "@/features/core/user/types";

export default async function InsaneLayout({
  children,
}: Readonly<{ children: ReactNode }>) {

  const ROLE_ADMIN: UserRoleType = "admin";
  const { total: adminUserCount } = await userService.search({
    limit: 1,
    where: { field: "role", op: "eq", value: ROLE_ADMIN },
  });

  // 管理者ユーザーが未作成の環境では、初期セットアップへリダイレクト
  if (adminUserCount === 0) redirect("/admin/setup");

  await authGuard({ allowRoles: ["admin"], redirectTo: "/admin/login" });

  return <InsaneProtectedLayout>{children}</InsaneProtectedLayout>;
}
