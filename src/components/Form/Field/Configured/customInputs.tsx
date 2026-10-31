// src/components/Form/Field/Configured/customInputs.tsx
// 登録された入力部品（formInput: "<登録名>"）を引く Context。一覧は知らない（src/wiring/formInputs/FormInputsRoot が渡す）

"use client";

import { createContext, lazy, Suspense, useContext, useMemo, type ComponentType, type ReactNode } from "react";

import type { FormInputItem, FormInputProps } from "../types";

export type ResolvedFormInput = FormInputItem & { Part: ComponentType<FormInputProps> };

const CustomFormInputsContext = createContext<Readonly<Record<string, ResolvedFormInput>>>({});

/** 項目ごとに React.lazy を 1 回だけ作る（本体は使う画面で初めて読み込む） */
export function resolveFormInputs(inputs: Readonly<Record<string, FormInputItem>>): Record<string, ResolvedFormInput> {
  return Object.fromEntries(Object.entries(inputs).map(([name, item]) => [name, { ...item, Part: lazy(item.load) }]));
}

export function FormInputsProvider({ inputs, children }: Readonly<{ inputs: Readonly<Record<string, FormInputItem>>; children: ReactNode }>) {
  const resolved = useMemo(() => resolveFormInputs(inputs), [inputs]);
  return <CustomFormInputsContext.Provider value={resolved}>{children}</CustomFormInputsContext.Provider>;
}

/** 登録の一覧（同じ枠の中で複数の名前を引く所用） */
export const useCustomFormInputs = () => useContext(CustomFormInputsContext);

/** 登録名の項目。登録されていなければ undefined */
export function useCustomFormInput(name: string): ResolvedFormInput | undefined {
  const inputs = useCustomFormInputs();
  return Object.hasOwn(inputs, name) ? inputs[name] : undefined;
}

/**
 * 部品を読み込み待ちごと描く。FormControl（Slot）が渡す id・aria-* は Suspense で落ちるので、ここで受けて部品へ渡す
 */
export function CustomFormInput({ item, ...props }: FormInputProps & { item: ResolvedFormInput }) {
  const { Part } = item;
  return (
    <Suspense fallback={null}>
      <Part {...props} />
    </Suspense>
  );
}
