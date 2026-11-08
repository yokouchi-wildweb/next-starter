// src/app/(user)/(auth)/reactivate/_screen/loader.ts
// /reactivate(休会からの復帰)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 root(src/app/guard.ts)の createLoader(access public、allowStatuses = 全 status)。遷移制御だけ(Promise<void>)。
// 休会中(inactive)の利用者を案内する画面なので、public の ctx.user を全 status で受ける(既定は active だけが非 null)。
// 休会機能(gate.enabled("pause"))が無効なら notFound。未ログインは LOGIN_PATH(/login)へ、inactive 以外(すでに復帰済み等)は HOME_PATH(/)へ。
// 復帰の実行はセクションコンテナ Reactivate が hook で行う。
// 行き先は下の名前付きの定数(export しない)。fork が変える口は持たない: 別の行き先が要る fork は同じ guard の
// createLoader で自分の loader を書く(src/lib/screens/README.md §3)

import "server-only";

import { notFound, redirect } from "next/navigation";

import { gate } from "@/featureGate";
import { USER_STATUSES } from "@/features/core/user/constants";
import { createLoader } from "@/app/guard";

/** 未ログインのときの行き先 */
const LOGIN_PATH = "/login";
/** 休会中(inactive)でないときの行き先 */
const HOME_PATH = "/";

export const loadReactivateScreen = createLoader({
  access: "public",
  allowStatuses: USER_STATUSES,
  load: async ({ user }): Promise<void> => {
    if (!gate.enabled("pause")) {
      notFound();
    }
    if (!user) {
      redirect(LOGIN_PATH);
    }
    if (user.status !== "inactive") {
      redirect(HOME_PATH);
    }
  },
});
