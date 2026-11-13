// src/features/core/messaging/components/common/PreferenceCategoryRow/index.tsx
// 部品(props だけ): 1 つの経路の中の 1 つの種類(題・説明・その経路での切り替え。入 = 受け取る)。
// 広い行で止まっているマスは切 + 理由。全部の停止(via all)の下だけ押せない(サーバーは全部の行を書き分けない)。
// ほかの広い行(種類・種別・経路まるごと)の下は押せて、入にするとサーバーが 1 つの transaction で書き分ける。
// 行に足す操作(種類まるごとの切り替えなど)は children

"use client";

import type { ReactNode } from "react";

import { SwitchInput } from "@/components/Form/Input/Manual";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";

import type {
  MessagePreferenceCategoryDto,
  MessagePreferenceVia,
} from "@/features/core/messaging/services/client/preferenceClient";

export type PreferenceCategoryRowProps = {
  /** 1 つの経路での種類(応答の channels[].kinds[].groups[].categories[]) */
  category: MessagePreferenceCategoryDto;
  /** 経路の表示名(切り替えの読み上げ) */
  channelLabel: string;
  /** 押せなくする(変えている最中・全部を止めている間) */
  disabled?: boolean;
  /** receive = true で受け取る */
  onChange: (receive: boolean) => void;
  children?: ReactNode;
};

/** 広い行で止まっている理由(null = このマスの行か、受け取っている) */
export function preferenceViaReason(via: MessagePreferenceVia | null): string | null {
  switch (via) {
    case "all":
      return "すべての連絡を止めています";
    case "category":
      return "このカテゴリーをすべての経路で止めています";
    case "channel":
      return "この経路をまとめて止めています";
    case "kind":
      return "まとめて止める設定で止まっています";
    default:
      return null;
  }
}

export function PreferenceCategoryRow({ category, channelLabel, disabled = false, onChange, children }: PreferenceCategoryRowProps) {
  const reason = preferenceViaReason(category.via);
  return (
    <Stack space={1}>
      <Flex justify="between" align="center" gap="md">
        <Stack space={0}>
          <Span>{category.label}</Span>
          {category.description ? (
            <Para size="sm" tone="muted">
              {category.description}
            </Para>
          ) : null}
          {reason ? (
            <Span size="xs" tone="muted">
              {reason}
            </Span>
          ) : null}
        </Stack>
        <SwitchInput
          value={!category.optedOut}
          onChange={(receive) => onChange(receive)}
          disabled={disabled || category.via === "all"}
          aria-label={`${category.label}を${channelLabel}で受け取る`}
        />
      </Flex>
      {children}
    </Stack>
  );
}
