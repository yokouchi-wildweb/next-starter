// src/app/admin/(protected)/users/system/[id]/edit/_screen/loader.ts
// /admin/users/system/[id]/edit の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: ユーザーが無ければ 404。ロール区分が user のユーザーなら /admin/users/general/[id]/edit へ redirect する
// (一般ユーザーとシステム管理者で編集画面が分かれているため)。ロールにプロフィールがあれば取得する(無ければ undefined)。
// 認可は admin/(protected)/layout.tsx の authGuard が担うため、ここでは行わない。

import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import type { ScreenProps } from "@/lib/screens/types";
import type { User } from "@/features/core/user/entities";
import { getRoleCategory, type UserRoleType } from "@/features/core/user/constants";
import { userService } from "@/features/core/user/services/server/userService";
import { userProfileService } from "@/features/core/userProfile/services/server/userProfileService";

export type AdminSystemUserEditScreenParams = { id: string };

export type AdminSystemUserEditScreenData = {
  user: User;
  /** ロール別プロフィール(ロールにプロフィールが無ければ undefined) */
  profileData: Record<string, unknown> | undefined;
};

const resolveAdminSystemUserEditScreen = cache(async (id: string): Promise<AdminSystemUserEditScreenData> => {
  const user = await userService.get(id);
  if (!user) notFound();
  if (getRoleCategory(user.role) === "user") {
    redirect(`/admin/users/general/${id}/edit`);
  }
  const profileData = await userProfileService.getProfile(id, user.role as UserRoleType);
  return { user, profileData: profileData ?? undefined };
});

export async function loadAdminSystemUserEditScreen(
  props: ScreenProps<AdminSystemUserEditScreenParams>,
): Promise<AdminSystemUserEditScreenData> {
  const { id } = await props.params;
  return resolveAdminSystemUserEditScreen(id);
}
