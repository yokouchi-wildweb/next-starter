// src/app/(user)/(auth)/restricted/_screen/loader.ts
// /restricted(利用制限中の案内)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 未ログインは /login へ、active は / へ、inactive(休会)は /reactivate へ redirect。
// 残る status(suspended / banned / security_locked など)だけがこの画面を見る。Screen が文言を出し分けられるよう status を返す。
// (auth) は (protected) の外で layout の authGuard が無いため、セッションは loader 自身が getSessionUser(nullable)で見る
// (active 以外は (protected) の authGuard では通れない status なので、このルートは (auth) に置かれている)。

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import type { UserStatus } from "@/features/core/user/types";

export type RestrictedScreenData = {
  /** 本人の現在の status(active / inactive はここに来る前に redirect 済み) */
  status: UserStatus;
};

export const loadRestrictedScreen = cache(async (): Promise<RestrictedScreenData> => {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/login");
  }

  if (sessionUser.status === "active") {
    redirect("/");
  }

  if (sessionUser.status === "inactive") {
    redirect("/reactivate");
  }

  return { status: sessionUser.status };
});
