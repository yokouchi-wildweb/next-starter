// src/app/admin/(protected)/users/general/[id]/edit/_screen/loader.ts
// /admin/users/general/[id]/edit の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: ユーザーが無ければ 404。ロール区分が admin のユーザーなら /admin/users/system/[id]/edit へ redirect する
// (一般ユーザーとシステム管理者で編集画面が分かれているため)。ロールにプロフィールがあれば取得する(無ければ undefined)。
// 認可は範囲 admin/(protected)/users/guard.ts の createLoader(access admin ロール)。取得の前に評価する。

import "server-only";
import { notFound, redirect } from "next/navigation";

import type { ScreenProps } from "@/lib/screens/types";
import type { User } from "@/features/core/user/entities";
import { getRoleCategory, type UserRoleType } from "@/features/core/user/constants";
import { userService } from "@/features/core/user/services/server/userService";
import { userProfileService } from "@/features/core/userProfile/services/server/userProfileService";
import { createLoader } from "@/app/admin/(protected)/users/guard";

export type AdminGeneralUserEditScreenParams = { id: string };

export type AdminGeneralUserEditScreenData = {
  user: User;
  /** ロール別プロフィール(ロールにプロフィールが無ければ undefined) */
  profileData: Record<string, unknown> | undefined;
};

export const loadAdminGeneralUserEditScreen = createLoader({
  access: { roles: ["admin"] },
  key: async (props: ScreenProps<AdminGeneralUserEditScreenParams>): Promise<[string]> => {
    const { id } = await props.params;
    return [id];
  },
  load: async (_ctx, id): Promise<AdminGeneralUserEditScreenData> => {
    const user = await userService.get(id);
    if (!user) notFound();
    if (getRoleCategory(user.role) === "admin") {
      redirect(`/admin/users/system/${id}/edit`);
    }
    const profileData = await userProfileService.getProfile(id, user.role as UserRoleType);
    return { user, profileData: profileData ?? undefined };
  },
});

