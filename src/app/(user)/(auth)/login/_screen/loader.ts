// src/app/(user)/(auth)/login/_screen/loader.ts
// /login の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: searchParams.returnTo を内部パスに限定して(open redirect 対策、外部 URL は "/" に倒す)ログイン後の遷移先にする。
// 利用可能な status(USER_AVAILABLE_STATUSES = active)でログイン済みならその遷移先へ redirect する。
// active 以外(suspended / inactive / pending 等)のセッションはログイン済み扱いにせずフォームを見せる
// (別アカウントでログインし直せるようにする。authGuard() の既定 allowStatuses と同じ判定)。
// (auth) は (protected) の外なので layout の authGuard は無く、セッションは loader 自身が getSessionUser(nullable)で見る。

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { USER_AVAILABLE_STATUSES } from "@/features/core/user/constants";
import { resolveReturnTo } from "@/lib/crud/utils/paths";
import type { ScreenProps } from "@/lib/screens/types";

/** returnTo 未指定・不正時のログイン後の遷移先 */
const DEFAULT_REDIRECT_PATH = "/";

export type LoginScreenSearchParams = {
  /** ログイン後に戻る内部パス(未解釈) */
  returnTo?: string | string[];
};

export type LoginScreenData = {
  /** ログイン後の遷移先(内部パスに限定済み) */
  redirectTo: string;
};

const resolveLoginScreen = cache(async (rawReturnTo: string | undefined): Promise<LoginScreenData> => {
  const redirectTo = resolveReturnTo(rawReturnTo, DEFAULT_REDIRECT_PATH);

  const sessionUser = await getSessionUser();
  if (sessionUser && USER_AVAILABLE_STATUSES.includes(sessionUser.status)) {
    redirect(redirectTo);
  }

  return { redirectTo };
});

export async function loadLoginScreen(
  props: ScreenProps<Record<string, never>, LoginScreenSearchParams>,
): Promise<LoginScreenData> {
  const { returnTo } = await props.searchParams;
  return resolveLoginScreen(typeof returnTo === "string" ? returnTo : undefined);
}
