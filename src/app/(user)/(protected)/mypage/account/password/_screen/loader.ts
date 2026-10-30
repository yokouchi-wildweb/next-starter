// src/app/(user)/(protected)/mypage/account/password/_screen/loader.ts
// /mypage/account/password(パスワード変更)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 (user)/(protected) の createLoader(access authenticated。未ログインは /login)。
// パスワード変更はメール認証ユーザーのみ: providerType が "email" でない、またはメール未設定なら /mypage/account へ redirect。

import "server-only";

import { redirect } from "next/navigation";

import { requireUserRecord } from "@/features/core/user/services/server/userService";
import { createLoader } from "@/app/(user)/(protected)/guard";

export type MyPageAccountPasswordScreenData = {
  /** 本人のメールアドレス(パスワード変更の対象) */
  email: string;
};

export const loadMyPageAccountPasswordScreen = createLoader({
  access: "authenticated",
  load: async ({ user }): Promise<MyPageAccountPasswordScreenData> => {
    const record = await requireUserRecord(user, "/login");
    if (record.providerType !== "email" || !record.email) {
      redirect("/mypage/account");
    }
    return { email: record.email };
  },
});
