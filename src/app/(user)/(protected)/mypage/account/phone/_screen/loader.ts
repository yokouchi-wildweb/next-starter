// src/app/(user)/(protected)/mypage/account/phone/_screen/loader.ts
// /mypage/account/phone(電話番号認証)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 電話番号認証機能(APP_FEATURES.user.phoneVerificationEnabled)が無効なら /mypage/account へ redirect(ユーザー取得より前)。
// 未ログインは /login へ redirect(layout の authGuard と同じ遷移先)。本人の電話番号と認証日時を返す。

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";

import { APP_FEATURES } from "@/config/app/app-features.config";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export type MyPageAccountPhoneScreenData = {
  /** 現在の電話番号(未登録なら null) */
  phoneNumber: string | null;
  /** 電話番号認証日時(未認証なら null) */
  phoneVerifiedAt: Date | null;
};

export const loadMyPageAccountPhoneScreen = cache(async (): Promise<MyPageAccountPhoneScreenData> => {
  if (!APP_FEATURES.user.phoneVerificationEnabled) {
    redirect("/mypage/account");
  }

  const user = await requireCurrentUser({ behavior: "redirect", redirectTo: "/login" });
  return { phoneNumber: user.phoneNumber, phoneVerifiedAt: user.phoneVerifiedAt };
});
