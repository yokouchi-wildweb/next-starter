// src/lib/formSuite/Field/Configured/customInputs.tsx
// 登録された入力部品（formInput: "<登録名>"）を引く Context。一覧は知らない（生成物 src/wiring/formSuite.ts の結び目 FormInputsRoot が門番で絞って渡す、宣言 src/lib/formSuite/extensionPoints.ts）

"use client";

import { createContext, lazy, Suspense, useContext, useMemo, type ComponentType, type ReactNode } from "react";

import type { FormInputItem, FormInputProps } from "../types";

export type ResolvedFormInput = FormInputItem & { Part: ComponentType<FormInputProps> };

const CustomFormInputsContext = createContext<Readonly<Record<string, ResolvedFormInput>>>({});

/** 生成された一覧の項目(plugs の点 formInputs。門番の欄 domain・requires は読まない) */
export type FormInputPlug = { readonly plug: FormInputItem };

/** 項目ごとの部品(React.lazy は項目 1 つに 1 回だけ。一覧が描くたびに作り直されても部品は同じ) */
const resolvedByItem = new WeakMap<FormInputItem, ResolvedFormInput>();
const resolveFormInput = (item: FormInputItem): ResolvedFormInput => {
  const known = resolvedByItem.get(item);
  if (known) return known;
  const resolved = { ...item, Part: lazy(item.load) };
  resolvedByItem.set(item, resolved);
  return resolved;
};

/** 項目ごとに React.lazy を 1 回だけ作る（本体は使う画面で初めて読み込む） */
export function resolveFormInputs(inputs: Readonly<Record<string, FormInputItem>>): Record<string, ResolvedFormInput> {
  return Object.fromEntries(Object.entries(inputs).map(([name, item]) => [name, resolveFormInput(item)]));
}

/** 一覧(登録名 = 項目の name)を Context に置く。一覧は呼び手が門番で絞って渡す */
export function FormInputsProvider({ formInputs, children }: Readonly<{ formInputs: readonly FormInputPlug[]; children?: ReactNode }>) {
  const resolved = useMemo(() => resolveFormInputs(Object.fromEntries(formInputs.map(({ plug }) => [plug.name, plug]))), [formInputs]);
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
