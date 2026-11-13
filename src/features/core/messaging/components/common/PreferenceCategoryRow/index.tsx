// src/features/core/messaging/components/common/PreferenceCategoryRow/index.tsx
// 部品(props だけ): 1 つの種類(題・説明)と、その種類の経路ごとの切り替え(PreferenceChannelToggle)

"use client";

import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

import type {
  MessagePreferenceCategoryRowDto,
  MessagePreferenceChannelDto,
} from "@/features/core/messaging/services/client/preferenceClient";

import { PreferenceChannelToggle } from "../PreferenceChannelToggle";

export type PreferenceCategoryRowProps = {
  /** 種類ごとの行(hook useMessagePreferences の categoryRows) */
  category: MessagePreferenceCategoryRowDto;
  /** 経路の並び(表の列。マスは category.cells から channel で引く) */
  channels: MessagePreferenceChannelDto[];
  /** 変えている最中の経路(押せない) */
  pendingChannel?: string | null;
  /** 全部を押せなくする(全体の切り替えの最中など) */
  disabled?: boolean;
  onChange: (channel: string, receive: boolean) => void;
};

export function PreferenceCategoryRow({ category, channels, pendingChannel = null, disabled = false, onChange }: PreferenceCategoryRowProps) {
  return (
    <Block className="rounded-md border border-border p-4">
      <Stack space={3}>
        <Stack space={1}>
          <Para weight="bold">{category.label}</Para>
          {category.description ? (
            <Para size="sm" tone="muted">
              {category.description}
            </Para>
          ) : null}
        </Stack>
        <Stack space={2}>
          {channels.map((channel) => {
            const cell = category.cells.find((c) => c.channel === channel.key);
            if (!cell) return null;
            return (
              <PreferenceChannelToggle
                key={channel.key}
                channel={channel}
                cell={cell}
                pending={disabled || pendingChannel === channel.key}
                onChange={(receive) => onChange(channel.key, receive)}
              />
            );
          })}
        </Stack>
      </Stack>
    </Block>
  );
}
