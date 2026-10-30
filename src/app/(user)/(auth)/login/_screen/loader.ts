// src/app/(user)/(auth)/login/_screen/loader.ts
// /login の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 root(src/app/guard.ts)の createLoader(access public)。
// searchParams.returnTo を内部パスに限定して(open redirect 対策、外部 URL は "/" に倒す)ログイン後の遷移先にする。
// 利用可能な status(USER_AVAILABLE_STATUSES = active)でログイン済み(public の ctx.user が非 null)ならその遷移先へ redirect する。
// active 以外(suspended / inactive / pending 等)のセッションは ctx.user が null になり、ログイン済み扱いにせずフォームを見せる
// (別アカウントでログインし直せるようにする)。

import "server-only";

import { redirect } from "next/navigation";

import { resolveReturnTo } from "@/lib/crud/utils/paths";
import type { ScreenProps } from "@/lib/screens/types";
import { createLoader } from "@/app/guard";

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

export const loadLoginScreen = createLoader({
  access: "public",
  key: async (props: ScreenProps<Record<string, never>, LoginScreenSearchParams>): Promise<[string | undefined]> => {
    const { returnTo } = await props.searchParams;
    return [typeof returnTo === "string" ? returnTo : undefined];
  },
  load: async ({ user }, rawReturnTo): Promise<LoginScreenData> => {
    const redirectTo = resolveReturnTo(rawReturnTo, DEFAULT_REDIRECT_PATH);
    if (user) {
      redirect(redirectTo);
    }
    return { redirectTo };
  },
});
