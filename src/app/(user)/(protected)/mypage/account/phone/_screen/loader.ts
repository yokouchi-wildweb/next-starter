// src/app/(user)/(protected)/mypage/account/phone/_screen/loader.ts
// /mypage/account/phone(電話番号認証)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 (user)/(protected) の createLoader(access authenticated。未ログインは /login)。
// 電話番号認証機能(APP_FEATURES.user.phoneVerificationEnabled)が無効なら /mypage/account へ redirect(レコードの取得より前)。
// 本人の電話番号と認証日時を返す。

import "server-only";

import { redirect } from "next/navigation";

import { APP_FEATURES } from "@/config/app/app-features.config";
import { requireUserRecord } from "@/features/core/user/services/server/userService";
import { createLoader } from "@/app/(user)/(protected)/guard";

export type MyPageAccountPhoneScreenData = {
  /** 現在の電話番号(未登録なら null) */
  phoneNumber: string | null;
  /** 電話番号認証日時(未認証なら null) */
  phoneVerifiedAt: Date | null;
};

export const loadMyPageAccountPhoneScreen = createLoader({
  access: "authenticated",
  load: async ({ user }): Promise<MyPageAccountPhoneScreenData> => {
    if (!APP_FEATURES.user.phoneVerificationEnabled) {
      redirect("/mypage/account");
    }
    const record = await requireUserRecord(user, "/login");
    return { phoneNumber: record.phoneNumber, phoneVerifiedAt: record.phoneVerifiedAt };
  },
});
