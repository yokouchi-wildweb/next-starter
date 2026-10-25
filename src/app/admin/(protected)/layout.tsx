// src/app/admin/(protected)/layout.tsx

import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { AdminProtectedLayout } from "./_layout/AdminProtectedLayout";
import { authGuard, hasAdminUser } from "@/features/core/auth/services/server/authorization";
import { getRolesByCategory } from "@/features/core/user/constants";

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {

  const adminRoles = getRolesByCategory("admin");

  // 管理者ユーザーが未作成の環境では、保護された管理画面全体へのアクセスを初期セットアップ導線へ統一する
  // ため、初期化フローを開始する専用ページへ即座にリダイレクトする
  // (layout はデータを取らないので、判定は authorization の hasAdminUser に任せる)
  if (!(await hasAdminUser(adminRoles))) redirect("/admin/setup");

  await authGuard({ allowRoles: adminRoles, redirectTo: "/admin/login", returnBack: true });

  return <AdminProtectedLayout>{children}</AdminProtectedLayout>;
}
