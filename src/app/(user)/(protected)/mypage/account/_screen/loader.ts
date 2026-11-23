// src/app/(user)/(protected)/mypage/account/_screen/loader.ts
// /mypage/account(アカウント基本情報)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 (user)/(protected) の createLoader(access authenticated。未ログインは範囲の行き先 /login)。
// 本人のユーザーレコードを返す(レコードが無ければ /login)。
// セクションコンテナ(AccountDetails)の契約が user: User なので DTO も User のまま渡す(秘匿列はサービス側で null 化済み)。

import "server-only";

import type { User } from "@/domains/core/user/entities";
import { requireUserRecord } from "@/domains/core/user/services/server/userService";
import { createLoader } from "@/app/(user)/(protected)/guard";

export type MyPageAccountScreenData = { user: User };

export const loadMyPageAccountScreen = createLoader({
  access: "authenticated",
  load: async ({ getUser }): Promise<MyPageAccountScreenData> => {
    const user = await getUser();
    return { user: await requireUserRecord(user, "/login") };
  },
});
