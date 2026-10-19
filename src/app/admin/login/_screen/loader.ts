// src/app/admin/login/_screen/loader.ts
// /admin/login の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: searchParams.returnTo を内部パスに限定して(open redirect 対策、外部 URL は "/admin" に倒す)ログイン後の遷移先にする。
// 管理者ロール(admin 区分)かつ利用可能な status でログイン済みならその遷移先へ redirect する
// (authGuard を redirectTo 無しで呼ぶと、許可されないセッションは null が返るだけで遷移しない)。
// /admin/login は (protected) の外なので layout の authGuard は無く、判定は loader 自身が行う。

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";

import { authGuard } from "@/features/core/auth/services/server/authorization";
import { getRolesByCategory } from "@/features/core/user/constants";
import { resolveReturnTo } from "@/lib/crud/utils/paths";
import type { ScreenProps } from "@/lib/screens/types";

/** returnTo 未指定・不正時のログイン後の遷移先 */
const DEFAULT_REDIRECT_PATH = "/admin";

export type AdminLoginScreenSearchParams = {
  /** ログイン後に戻る内部パス(未解釈) */
  returnTo?: string | string[];
};

export type AdminLoginScreenData = {
  /** ログイン後の遷移先(内部パスに限定済み) */
  redirectTo: string;
};

const resolveAdminLoginScreen = cache(async (rawReturnTo: string | undefined): Promise<AdminLoginScreenData> => {
  const redirectTo = resolveReturnTo(rawReturnTo, DEFAULT_REDIRECT_PATH);

  const sessionUser = await authGuard({ allowRoles: getRolesByCategory("admin") });
  if (sessionUser) {
    redirect(redirectTo);
  }

  return { redirectTo };
});

export async function loadAdminLoginScreen(
  props: ScreenProps<Record<string, never>, AdminLoginScreenSearchParams>,
): Promise<AdminLoginScreenData> {
  const { returnTo } = await props.searchParams;
  return resolveAdminLoginScreen(typeof returnTo === "string" ? returnTo : undefined);
}
