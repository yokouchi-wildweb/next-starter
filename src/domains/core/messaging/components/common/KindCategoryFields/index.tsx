// src/domains/core/messaging/components/common/KindCategoryFields/index.tsx
// 部品(props だけ): 種別とカテゴリーを 1 行に並べる選択(D118)。左 = 種別、右 = カテゴリー。テンプレートのモーダルと送る画面が使う。
// - カテゴリーはいつも出す(1 つでも)。種別を選ぶまでは空で押せない。空の選択肢(「選んでください」)は置かない
// - 種別を選ぶと呼び手(hook)がその種別の最初のカテゴリーを選ぶ(この部品は描くだけ)

"use client";

import { SelectInput } from "@/components/Input/Select";
import { Label } from "@/components/Input/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";

export type KindCategoryOption = { value: string; label: string };

export type KindCategoryFieldsProps = {
  kinds: readonly KindCategoryOption[];
  /** 選んだ種別(空 = まだ選んでいない) */
  kind: string;
  onKindChange: (kind: string) => void;
  /** 選んだ種別のカテゴリー */
  categories: readonly KindCategoryOption[];
  category: string;
  onCategoryChange: (category: string) => void;
  disabled?: boolean;
  /** 欄の id の頭(1 画面に 2 つ置く時に分ける) */
  idPrefix?: string;
  /** 「種別」「カテゴリー」の見出しを見た目から隠す(読み上げには残す)。呼び手が行の見出しを持つ時(送るモーダル) */
  hideLabels?: boolean;
};

export function KindCategoryFields({
  kinds,
  kind,
  onKindChange,
  categories,
  category,
  onCategoryChange,
  disabled,
  idPrefix = "message",
  hideLabels = false,
}: KindCategoryFieldsProps) {
  const labelClass = hideLabels ? "sr-only" : "text-sm";
  if (kinds.length === 0) {
    return (
      <Span size="sm" tone="muted" data-slot="kind-category-fields">
        管理画面から送れる種別がありません
      </Span>
    );
  }
  return (
    <Flex align="start" gap="md" wrap="wrap" data-slot="kind-category-fields">
      <Stack gap="2xs" className="min-w-40 flex-1">
        <Label htmlFor={`${idPrefix}-kind`} className={labelClass}>
          種別
        </Label>
        <SelectInput
          id={`${idPrefix}-kind`}
          value={kind}
          options={[...kinds]}
          placeholder="種別を選択"
          showPlaceholderOption={false}
          disabled={disabled}
          onChange={(v) => onKindChange(v ? String(v) : "")}
        />
      </Stack>
      <Stack gap="2xs" className="min-w-40 flex-1">
        <Label htmlFor={`${idPrefix}-category`} className={labelClass}>
          カテゴリー
        </Label>
        <SelectInput
          id={`${idPrefix}-category`}
          value={category}
          options={[...categories]}
          placeholder={kind ? "カテゴリーがありません" : "種別を先に選択"}
          showPlaceholderOption={false}
          disabled={disabled || !kind || categories.length === 0}
          onChange={(v) => onCategoryChange(v ? String(v) : "")}
        />
      </Stack>
    </Flex>
  );
}
