// src/app/(user)/(auth)/password/reset/_screen/loader.ts
// /password/reset(パスワード再設定リンクの着地)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: URL の解釈だけ。searchParams.oobCode(Firebase のアクションコード)を取り出して返す。無ければ null
// (コードの検証と再設定はセクションコンテナ ResetPassword が client 側で行う)。サーバー側の取得も redirect も無い。

import "server-only";
import { cache } from "react";

import type { ScreenProps } from "@/lib/screens/types";

export type PasswordResetScreenSearchParams = {
  /** Firebase のアクションコード(未解釈) */
  oobCode?: string | string[];
};

export type PasswordResetScreenData = {
  /** アクションコード。URL に無ければ null */
  oobCode: string | null;
};

const resolvePasswordResetScreen = cache(async (oobCode: string | null): Promise<PasswordResetScreenData> => {
  return { oobCode };
});

export async function loadPasswordResetScreen(
  props: ScreenProps<Record<string, never>, PasswordResetScreenSearchParams>,
): Promise<PasswordResetScreenData> {
  const { oobCode } = await props.searchParams;
  return resolvePasswordResetScreen(typeof oobCode === "string" && oobCode !== "" ? oobCode : null);
}
