// src/app/(user)/(auth)/reactivate/_screen/loader.ts
// /reactivate(休会からの復帰)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 root(src/app/guard.ts)の createLoader(access public、allowStatuses = 全 status)。遷移制御だけ(Promise<void>)。
// 休会中(inactive)の利用者を案内する画面なので、public の ctx.user を全 status で受ける(既定は active だけが非 null)。
// 休会機能(APP_FEATURES.user.pauseEnabled)が無効なら notFound。未ログインは /login へ、inactive 以外(すでに復帰済み等)は / へ。
// 復帰の実行はセクションコンテナ Reactivate が hook で行う。

import "server-only";

import { notFound, redirect } from "next/navigation";

import { APP_FEATURES } from "@/config/app/app-features.config";
import { USER_STATUSES } from "@/features/core/user/constants";
import { createLoader } from "@/app/guard";

export const loadReactivateScreen = createLoader({
  access: "public",
  allowStatuses: USER_STATUSES,
  load: async ({ user }): Promise<void> => {
    if (!APP_FEATURES.user.pauseEnabled) {
      notFound();
    }
    if (!user) {
      redirect("/login");
    }
    if (user.status !== "inactive") {
      redirect("/");
    }
  },
});
