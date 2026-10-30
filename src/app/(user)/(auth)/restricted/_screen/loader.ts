// src/app/(user)/(auth)/restricted/_screen/loader.ts
// /restricted(利用制限中の案内)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 root(src/app/guard.ts)の createLoader(access public、allowStatuses = 全 status)。
// 利用できない status の利用者を案内する画面なので、public の ctx.user を全 status で受ける(既定は active だけが非 null)。
// 未ログインは /login へ、active は / へ、inactive(休会)は /reactivate へ redirect。
// 残る status(suspended / banned / security_locked など)だけがこの画面を見る。Screen が文言を出し分けられるよう status を返す。

import "server-only";

import { redirect } from "next/navigation";

import { USER_STATUSES } from "@/features/core/user/constants";
import type { UserStatus } from "@/features/core/user/types";
import { createLoader } from "@/app/guard";

export type RestrictedScreenData = {
  /** 本人の現在の status(active / inactive はここに来る前に redirect 済み) */
  status: UserStatus;
};

export const loadRestrictedScreen = createLoader({
  access: "public",
  allowStatuses: USER_STATUSES,
  load: async ({ user }): Promise<RestrictedScreenData> => {
    if (!user) {
      redirect("/login");
    }
    if (user.status === "active") {
      redirect("/");
    }
    if (user.status === "inactive") {
      redirect("/reactivate");
    }
    return { status: user.status };
  },
});
