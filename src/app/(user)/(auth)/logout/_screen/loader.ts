// src/app/(user)/(auth)/logout/_screen/loader.ts
// /logout の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: URL の解釈だけ。searchParams.redirectTo を内部パスに限定して(open redirect 対策、外部 URL は "/" に倒す)
// ログアウト後の遷移先として返す。ログアウトの実行は client 部品(LogoutSection)が hook で行う。
// サーバー側の取得も redirect も無い(未ログインでもログアウト処理は冪等に動く)。

import "server-only";
import { cache } from "react";

import { resolveReturnTo } from "@/lib/crud/utils/paths";
import type { ScreenProps } from "@/lib/screens/types";

/** redirectTo 未指定・不正時のログアウト後の遷移先 */
const DEFAULT_REDIRECT_PATH = "/";

export type LogoutScreenSearchParams = {
  /** ログアウト後に移動する内部パス(未解釈) */
  redirectTo?: string | string[];
};

export type LogoutScreenData = {
  /** ログアウト後の遷移先(内部パスに限定済み) */
  redirectTo: string;
};

const resolveLogoutScreen = cache(async (rawRedirectTo: string | undefined): Promise<LogoutScreenData> => {
  return { redirectTo: resolveReturnTo(rawRedirectTo, DEFAULT_REDIRECT_PATH) };
});

export async function loadLogoutScreen(
  props: ScreenProps<Record<string, never>, LogoutScreenSearchParams>,
): Promise<LogoutScreenData> {
  const { redirectTo } = await props.searchParams;
  return resolveLogoutScreen(typeof redirectTo === "string" ? redirectTo : undefined);
}
