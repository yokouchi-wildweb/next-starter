// src/domains/core/messaging/components/common/DispatchFilterChips/index.tsx
// 部品(props だけ): 送信の一覧でかけている絞り込みを「名前: 値」の札で並べ、× で 1 つずつ外す。右端に「すべて解除」。
// 札が 0 個なら何も出さない。札の文は置き場が表示名で作る(鍵・id は見せない、D46)

"use client";

import { X } from "lucide-react";

import { Button } from "@/components/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Span } from "@/components/TextBlocks/Span";

export type DispatchFilterChip = {
  /** 札の識別子(欄の名前) */
  key: string;
  /** 欄の名前(例: 種別) */
  label: string;
  /** 選んだ値の表示名 */
  value: string;
  /** この絞り込みを外す */
  onRemove: () => void;
};

export type DispatchFilterChipsProps = {
  chips: DispatchFilterChip[];
  /** すべての絞り込みを外す(無ければ「すべて解除」を出さない) */
  onClearAll?: () => void;
};

export function DispatchFilterChips({ chips, onClearAll }: DispatchFilterChipsProps) {
  if (chips.length === 0) return null;
  return (
    <Flex gap="xs" align="center" wrap="wrap" data-slot="dispatch-filter-chips">
      {chips.map((chip) => (
        <Button
          key={chip.key}
          type="button"
          variant="outline"
          size="xxs"
          className="rounded-full"
          aria-label={`${chip.label}「${chip.value}」の絞り込みを外す`}
          data-slot="dispatch-filter-chip"
          onClick={chip.onRemove}
        >
          <Span size="xs" tone="muted">
            {chip.label}:
          </Span>
          <Span size="xs">{chip.value}</Span>
          <X aria-hidden />
        </Button>
      ))}
      {onClearAll ? (
        <Button type="button" variant="ghost" size="xxs" onClick={onClearAll} data-slot="dispatch-filter-clear">
          すべて解除
        </Button>
      ) : null}
    </Flex>
  );
}
