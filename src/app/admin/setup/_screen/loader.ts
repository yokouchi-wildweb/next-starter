// src/app/admin/setup/_screen/loader.ts
// /admin/setup の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 遷移制御だけの loader(Promise<void>)。管理者ユーザーが既に 1 人でもいれば /admin/login へ redirect する
// (初期セットアップは最初の管理者を作るときだけ。セッションは見ない)。

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";

import { userService } from "@/features/core/user/services/server/userService";

export const loadAdminSetupScreen = cache(async (): Promise<void> => {
  if (await userService.checkAdminUserExists()) {
    redirect("/admin/login");
  }
});
