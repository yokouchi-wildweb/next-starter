// src/components/Form/utils.ts

import { type Options } from "@/components/Form/types";

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
 * cmdk CommandItem のアイデンティティ用文字列（key / value 共用）。
 * cmdk は value をアイテムの同一性判定に使うため、ラベルではなく選択肢の値ベースで
 * 一意にする（ラベル重複時にハイライト・キーボード操作が同名行と衝突しないように）。
 * 値が null/undefined で空文字になる場合は index でフォールバック。
 */
export const resolveOptionItemIdentity = (option: Options, index: number) => {
  return serializeOptionValue(option.value) || `option-${index}`;
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
