// src/app/(user)/(protected)/mypage/account/password/_screen/loader.ts
// /mypage/account/password(パスワード変更)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 (user)/(protected) の createLoader(access authenticated。未ログインは /login)。
// パスワード変更はメール認証ユーザーのみ: providerType が "email" でない、またはメール未設定なら ACCOUNT_PATH(/mypage/account)へ redirect。
// 行き先は下の名前付きの定数(export しない)。fork が変える口は持たない: 別の行き先が要る fork は同じ guard の
// createLoader で自分の loader を書く(src/lib/screens/README.md §3)

import "server-only";

import { redirect } from "next/navigation";

import { requireUserRecord } from "@/features/core/user/services/server/userService";
import { createLoader } from "@/app/(user)/(protected)/guard";

/** レコードが無い(未ログイン)ときの行き先 */
const LOGIN_PATH = "/login";
/** パスワード変更の対象でない(email 以外・メール無し)ときの行き先 */
const ACCOUNT_PATH = "/mypage/account";

export type MyPageAccountPasswordScreenData = {
  /** 本人のメールアドレス(パスワード変更の対象) */
  email: string;
};

export const loadMyPageAccountPasswordScreen = createLoader({
  access: "authenticated",
  load: async ({ user }): Promise<MyPageAccountPasswordScreenData> => {
    const record = await requireUserRecord(user, LOGIN_PATH);
    if (record.providerType !== "email" || !record.email) {
      redirect(ACCOUNT_PATH);
    }
    return { email: record.email };
  },
});
