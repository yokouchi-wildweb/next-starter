// src/components/Form/utils.ts

import { type Options } from "@/types/form";

/**
 * Manual系のフォーム部品で共有する選択肢のプリミティブ値。
 */
export type OptionPrimitive = Options["value"];

export const serializeOptionValue = (value: OptionPrimitive | null | undefined) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

export const normalizeOptionValues = (values: OptionPrimitive[] | null | undefined) => {
  if (!Array.isArray(values)) {
    return [];
  }
  return values;
};

export const includesOptionValue = (
  values: OptionPrimitive[] | null | undefined,
  target: OptionPrimitive,
) => {
  if (!values || values.length === 0) {
    return false;
  }
  const targetSerialized = serializeOptionValue(target);
  return values.some((value) => serializeOptionValue(value) === targetSerialized);
};

export const toggleOptionValue = (
  currentValues: OptionPrimitive[] | null | undefined,
  nextValue: OptionPrimitive,
) => {
  const normalized = normalizeOptionValues(currentValues);
  const targetSerialized = serializeOptionValue(nextValue);
  const exists = normalized.some((value) => serializeOptionValue(value) === targetSerialized);
  if (exists) {
    return normalized.filter((value) => serializeOptionValue(value) !== targetSerialized);
  }
  return [...normalized, nextValue];
};

/**
 * Command検索用の文字列。label が文字列でない場合は value をフォールバックに使う。
 */
export const resolveOptionSearchText = (option: Options) => {
  const { label, value } = option;
  if (typeof label === "string" || typeof label === "number" || typeof label === "boolean") {
    return String(label);
  }
  return String(value);
};
