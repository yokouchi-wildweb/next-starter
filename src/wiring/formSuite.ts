// 生成物・編集不可: pnpm generate extensions が src/lib/formSuite/extensionPoints.ts から生成する
// formInputs: 差す側の <ドメイン>/plugs/formInputs/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const formInput(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)
// 結び目: src/lib/formSuite/extensionPoints.ts の wire(一覧を門番で絞って lib の FormInputsProvider に渡す)

"use client";

import { createElement, type ReactNode } from "react";

import { useGate } from "@/featureGate/client";
import { FormInputsProvider } from "@/lib/formSuite";

import type { FormInputItem } from "@/lib/formSuite/points";

export const formInputs: { domain: string | null; name: string; requires: readonly string[]; plug: FormInputItem }[] = [];

declare module "@/lib/formSuite" {
  // 登録名(項目の name の字面)を型に載せる
  interface RegisteredFormInputs extends Record<never, true> {}
}

export function FormInputsRoot({ children }: Readonly<{ children: ReactNode }>) {
  const gate = useGate();
  return createElement(FormInputsProvider, { formInputs: gate.plugs(formInputs) }, children);
}
