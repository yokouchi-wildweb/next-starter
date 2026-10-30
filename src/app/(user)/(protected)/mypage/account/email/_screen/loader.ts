// src/app/(user)/(protected)/mypage/account/email/_screen/loader.ts
// /mypage/account/email(メールアドレス編集)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 (user)/(protected) の createLoader(access authenticated。未ログインは /login)。本人の現在のメールアドレスを返す。

import "server-only";

import { requireUserRecord } from "@/features/core/user/services/server/userService";
import { createLoader } from "@/app/(user)/(protected)/guard";

export type MyPageAccountEmailScreenData = {
  /** 現在のメールアドレス(未設定なら null) */
  email: string | null;
};

export const loadMyPageAccountEmailScreen = createLoader({
  access: "authenticated",
  load: async ({ user }): Promise<MyPageAccountEmailScreenData> => {
    const record = await requireUserRecord(user, "/login");
    return { email: record.email };
  },
});
