// src/app/(user)/(protected)/mypage/account/_screen/loader.ts
// /mypage/account(アカウント基本情報)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 本人のユーザーレコードを返す。未ログインは /login へ redirect(layout の authGuard と同じ遷移先)。
// セクションコンテナ(AccountDetails)の契約が user: User なので DTO も User のまま渡す(秘匿列はサービス側で null 化済み)。

import "server-only";
import { cache } from "react";

import type { User } from "@/features/core/user/entities";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export type MyPageAccountScreenData = { user: User };

export const loadMyPageAccountScreen = cache(async (): Promise<MyPageAccountScreenData> => {
  const user = await requireCurrentUser({ behavior: "redirect", redirectTo: "/login" });
  return { user };
});
