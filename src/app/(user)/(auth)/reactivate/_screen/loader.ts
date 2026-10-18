// src/app/(user)/(auth)/reactivate/_screen/loader.ts
// /reactivate(休会からの復帰)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 遷移制御だけの loader(Promise<void>)。休会機能(APP_FEATURES.user.pauseEnabled)が無効なら notFound。
// 未ログインは /login へ、status が inactive 以外(すでに復帰済み等)は / へ redirect。
// (auth) は (protected) の外で layout の authGuard が無いため、セッションは loader 自身が getSessionUser(nullable)で見る
// (inactive は (protected) の authGuard では通れない status なので、このルートは (auth) に置かれている)。
// 復帰の実行はセクションコンテナ Reactivate が hook で行う。

import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import { APP_FEATURES } from "@/config/app/app-features.config";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";

export const loadReactivateScreen = cache(async (): Promise<void> => {
  if (!APP_FEATURES.user.pauseEnabled) {
    notFound();
  }

  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/login");
  }

  if (sessionUser.status !== "inactive") {
    redirect("/");
  }
});
