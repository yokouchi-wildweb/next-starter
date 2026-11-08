// src/app/(user)/(auth)/logout/_screen/loader.ts
// /logout の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 root(src/app/guard.ts)の createLoader(access public)。URL の解釈だけ。searchParams.redirectTo を内部パスに限定して(open redirect 対策、外部 URL は DEFAULT_REDIRECT_PATH "/" に倒す)
// ログアウト後の遷移先として返す。ログアウトの実行は client 部品(LogoutSection)が公開 hook useAutoLogout で行う。
// サーバー側の取得も redirect も無い(未ログインでもログアウト処理は冪等に動く)。
// 既定の行き先は下の名前付きの定数(export しない)。fork が変える口は持たない: 別の既定が要る fork は同じ guard の
// createLoader で自分の loader を書く(src/lib/screens/README.md §3)

import "server-only";

import { resolveReturnTo } from "@/lib/crud/utils/paths";
import type { ScreenProps } from "@/lib/screens/types";
import { createLoader } from "@/app/guard";

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

export const loadLogoutScreen = createLoader({
  access: "public",
  key: async (props: ScreenProps<Record<string, never>, LogoutScreenSearchParams>): Promise<[string | undefined]> => {
    const { redirectTo } = await props.searchParams;
    return [typeof redirectTo === "string" ? redirectTo : undefined];
  },
  load: async (_ctx, rawRedirectTo): Promise<LogoutScreenData> => {
    return { redirectTo: resolveReturnTo(rawRedirectTo, DEFAULT_REDIRECT_PATH) };
  },
});

