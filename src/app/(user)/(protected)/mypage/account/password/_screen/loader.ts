// src/app/(user)/(protected)/mypage/account/password/_screen/loader.ts
// /mypage/account/password(パスワード変更)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 未ログインは /login へ redirect(layout の authGuard と同じ遷移先)。
// パスワード変更はメール認証ユーザーのみ: providerType が "email" でない、またはメール未設定なら /mypage/account へ redirect。

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export type MyPageAccountPasswordScreenData = {
  /** 本人のメールアドレス(パスワード変更の対象) */
  email: string;
};

export const loadMyPageAccountPasswordScreen = cache(async (): Promise<MyPageAccountPasswordScreenData> => {
  const user = await requireCurrentUser({ behavior: "redirect", redirectTo: "/login" });

  if (user.providerType !== "email" || !user.email) {
    redirect("/mypage/account");
  }

  return { email: user.email };
});
