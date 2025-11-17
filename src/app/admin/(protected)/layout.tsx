// src/app/admin/(protected)/layout.tsx

import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { AdminProtectedLayout } from "@/components/Admin/Layout/AdminProtectedLayout";
import { authGuard } from "@/features/auth/services/server/authorization";
import { userService } from "@/features/user/services/server/userService";
import type { UserRoleType } from "@/types/user";

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {

  const ROLE_ADMIN: UserRoleType = "admin";
  const { total: adminUserCount } = await userService.search({
    limit: 1,
    where: { field: "role", op: "eq", value: ROLE_ADMIN },
  });

  // 管理者ユーザーが未作成の環境では、保護された管理画面全体へのアクセスを初期セットアップ導線へ統一する
  // ため、初期化フローを開始する専用ページへ即座にリダイレクトする
  if (adminUserCount === 0) redirect("/admin/setup");

  await authGuard({ allowRoles: ["admin"], redirectTo: "/admin/login" });

  return <AdminProtectedLayout>{children}</AdminProtectedLayout>;
}
