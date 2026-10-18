// src/app/(user)/(protected)/mypage/account/profile/_screen/loader.ts
// /mypage/account/profile(プロフィール編集)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 未ログインは /login へ redirect(layout の authGuard と同じ遷移先)。本人のユーザーレコードと、
// ロール別プロフィール(userProfileService.getProfile。ロールにプロフィール定義が無ければ null)を返す。
// セクションコンテナ(EditProfile)の契約が user: User なので DTO も User のまま渡す。
// profileData の型は getProfile の戻り型(Record<string, unknown> | null)に合わせている(型付き read model は未整備)。

import "server-only";
import { cache } from "react";

import type { User } from "@/features/core/user/entities";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";
import { userProfileService } from "@/features/core/userProfile/services/server/userProfileService";

export type MyPageAccountProfileScreenData = {
  user: User;
  /** ロール別プロフィール(定義が無いロールや未作成なら null) */
  profileData: Record<string, unknown> | null;
};

export const loadMyPageAccountProfileScreen = cache(async (): Promise<MyPageAccountProfileScreenData> => {
  const user = await requireCurrentUser({ behavior: "redirect", redirectTo: "/login" });
  const profileData = await userProfileService.getProfile(user.id, user.role);
  return { user, profileData };
});
