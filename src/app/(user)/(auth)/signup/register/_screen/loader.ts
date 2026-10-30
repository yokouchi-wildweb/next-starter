// src/app/(user)/(auth)/signup/register/_screen/loader.ts
// /signup/register(本登録フォーム)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 root(src/app/guard.ts)の createLoader(access public)。URL の解釈だけ。searchParams.method("email" | "thirdParty")を検証して返す。それ以外・未指定は undefined
// (セクションコンテナ Registration の既定 "email" に委ねる)。サーバー側の取得も redirect も無い
// (登録前の認証状態の確認はセクションコンテナが client 側で行う)。

import "server-only";

import type { RegistrationMethod } from "@/features/core/auth/components/Registration";
import type { ScreenProps } from "@/lib/screens/types";
import { createLoader } from "@/app/guard";

export type SignupRegisterScreenSearchParams = {
  /** 登録方法(未解釈) */
  method?: string | string[];
};

export type SignupRegisterScreenData = {
  /** 検証済みの登録方法。不正・未指定なら undefined */
  method: RegistrationMethod | undefined;
};

export const loadSignupRegisterScreen = createLoader({
  access: "public",
  key: async (props: ScreenProps<Record<string, never>, SignupRegisterScreenSearchParams>): Promise<[string | undefined]> => {
    const { method } = await props.searchParams;
    return [typeof method === "string" ? method : undefined];
  },
  load: async (_ctx, rawMethod): Promise<SignupRegisterScreenData> => {
    const method: RegistrationMethod | undefined =
      rawMethod === "thirdParty" ? "thirdParty" : rawMethod === "email" ? "email" : undefined;
    return { method };
  },
});

