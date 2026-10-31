// src/wiring/formInputs/FormInputsRoot.tsx
// 入力部品の一覧(生成物)を src/components/Form の Provider に渡す。一覧の load は関数でサーバーからクライアントへ props で渡せないので client に置く

"use client";

import type { ReactNode } from "react";

import { FormInputsProvider } from "@/components/Form/Field/Configured/customInputs";

import { inputs } from "./extensions/inputs";

declare module "@/components/Form/Field/types" {
  // 登録名を FieldConfig.formInput に載せる
  interface RegisteredFormInputs extends Record<keyof typeof inputs, true> {}
}

export function FormInputsRoot({ children }: Readonly<{ children: ReactNode }>) {
  return <FormInputsProvider inputs={inputs}>{children}</FormInputsProvider>;
}
