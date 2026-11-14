"use client";

// src/features/core/userGroup/hooks/useUserGroupCriterionArgs.ts
//
// 管理: 条件 1 つの引数の欄(部品 UserGroupCriterionFields が FieldRenderer に渡す react-hook-form)。
// - 欄 = 部品の fields(FieldConfig、name = 引数の鍵)。初めの値 = 今の引数(日時の欄は ISO の文字 → Date)
// - 書き換える度に onChange(引数): 日時は ISO の文字、空の欄(空の文字・null・空の並び)は落とす(サーバーの zod は optional を欠けで受ける)

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";

import type { FieldConfig } from "@/components/Form/Field/types";

type Fields = readonly FieldConfig[];

const isDateField = (field: Fields[number]) => field.formInput === "datetimeInput" || field.formInput === "dateInput";

/** 引数 → 欄の値 */
export function criterionFormValues(fields: Fields, args: Record<string, unknown>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    const value = args[field.name];
    if (value === undefined) continue;
    values[field.name] = isDateField(field) && typeof value === "string" ? new Date(value) : value;
  }
  return values;
}

/** 欄の値 → 引数 */
export function criterionArgsOf(fields: Fields, values: Record<string, unknown>): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.name];
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (value instanceof Date) {
      if (!Number.isNaN(value.getTime())) args[field.name] = value.toISOString();
      continue;
    }
    if (field.formInput === "numberInput" && typeof value === "string") {
      const n = Number(value);
      if (Number.isFinite(n)) args[field.name] = n;
      continue;
    }
    args[field.name] = value;
  }
  return args;
}

export type UseUserGroupCriterionArgsOptions = {
  fields: Fields;
  args: Record<string, unknown>;
  onChange: (args: Record<string, unknown>) => void;
};

export function useUserGroupCriterionArgs({ fields, args, onChange }: UseUserGroupCriterionArgsOptions) {
  const methods = useForm<Record<string, unknown>>({ defaultValues: criterionFormValues(fields, args) });
  const latest = useRef({ fields, onChange });
  useEffect(() => {
    latest.current = { fields, onChange };
  }, [fields, onChange]);

  const { subscribe } = methods;
  useEffect(
    () =>
      subscribe({
        formState: { values: true },
        callback: ({ values }) => latest.current.onChange(criterionArgsOf(latest.current.fields, values)),
      }),
    [subscribe],
  );

  return { methods, fields: [...fields] };
}
