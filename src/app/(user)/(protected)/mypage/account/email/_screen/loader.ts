// src/app/(user)/(protected)/mypage/account/email/_screen/loader.ts
// /mypage/account/email(メールアドレス編集)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 本人の現在のメールアドレスを返す。未ログインは /login へ redirect(layout の authGuard と同じ遷移先)。

import "server-only";
import { cache } from "react";

import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export type MyPageAccountEmailScreenData = {
  /** 現在のメールアドレス(未設定なら null) */
  email: string | null;
};

export const loadMyPageAccountEmailScreen = cache(async (): Promise<MyPageAccountEmailScreenData> => {
  const user = await requireCurrentUser({ behavior: "redirect", redirectTo: "/login" });
  return { email: user.email };
});
