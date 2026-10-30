// src/app/(user)/(auth)/signup/oauth/_screen/loader.ts
// /signup/oauth(OAuth 認証の往復ページ)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 root(src/app/guard.ts)の createLoader(access public)。URL の解釈だけ。searchParams.provider を USER_PROVIDER_TYPES で検証し(不正なら undefined = セクションコンテナが
// invalidProcess を表示)、searchParams.returnTo を内部パスに限定して(open redirect 対策、外部 URL は "/" に倒す)
// 登録済みユーザーのログイン後の遷移先にする。認証フローの実行はセクションコンテナ OAuth が hook で行う。

import "server-only";

import { USER_PROVIDER_TYPES } from "@/features/core/user/constants";
import type { UserProviderType } from "@/features/core/user/types";
import { resolveReturnTo } from "@/lib/crud/utils/paths";
import type { ScreenProps } from "@/lib/screens/types";
import { createLoader } from "@/app/guard";

/** returnTo 未指定・不正時の遷移先 */
const DEFAULT_REDIRECT_PATH = "/";

export type SignupOAuthScreenSearchParams = {
  /** OAuth プロバイダー種別(未解釈) */
  provider?: string | string[];
  /** 登録済みユーザーのログイン後に戻る内部パス(未解釈) */
  returnTo?: string | string[];
};

export type SignupOAuthScreenData = {
  /** 検証済みのプロバイダー。不正・未指定なら undefined */
  provider: UserProviderType | undefined;
  /** 登録済みユーザーのログイン後の遷移先(内部パスに限定済み) */
  redirectTo: string;
};

const isProviderType = (value: string): value is UserProviderType =>
  (USER_PROVIDER_TYPES as readonly string[]).includes(value);

export const loadSignupOAuthScreen = createLoader({
  access: "public",
  key: async (
    props: ScreenProps<Record<string, never>, SignupOAuthScreenSearchParams>,
  ): Promise<[string | undefined, string | undefined]> => {
    const { provider, returnTo } = await props.searchParams;
    return [typeof provider === "string" ? provider : undefined, typeof returnTo === "string" ? returnTo : undefined];
  },
  load: async (_ctx, rawProvider, rawReturnTo): Promise<SignupOAuthScreenData> => {
    const provider = rawProvider && isProviderType(rawProvider) ? rawProvider : undefined;
    return { provider, redirectTo: resolveReturnTo(rawReturnTo, DEFAULT_REDIRECT_PATH) };
  },
});
