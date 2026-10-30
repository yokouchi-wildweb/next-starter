// src/app/admin/login/_screen/loader.ts
// /admin/login の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 root(src/app/guard.ts)の createLoader(access public)。/admin/login は admin/(protected) の外。
// searchParams.returnTo を内部パスに限定して(open redirect 対策、外部 URL は "/admin" に倒す)ログイン後の遷移先にする。
// 管理者カテゴリかつ利用可能な status でログイン済み(ctx.allows で判定)ならその遷移先へ redirect する。

import "server-only";

import { redirect } from "next/navigation";

import { resolveReturnTo } from "@/lib/crud/utils/paths";
import type { ScreenProps } from "@/lib/screens/types";
import { createLoader } from "@/app/guard";

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

export const loadAdminLoginScreen = createLoader({
  access: "public",
  key: async (props: ScreenProps<Record<string, never>, AdminLoginScreenSearchParams>): Promise<[string | undefined]> => {
    const { returnTo } = await props.searchParams;
    return [typeof returnTo === "string" ? returnTo : undefined];
  },
  load: async ({ allows }, rawReturnTo): Promise<AdminLoginScreenData> => {
    const redirectTo = resolveReturnTo(rawReturnTo, DEFAULT_REDIRECT_PATH);
    if (allows({ roleCategories: ["admin"] })) {
      redirect(redirectTo);
    }
    return { redirectTo };
  },
});
