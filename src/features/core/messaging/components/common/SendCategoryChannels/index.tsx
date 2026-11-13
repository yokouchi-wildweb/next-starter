// src/features/core/messaging/components/common/SendCategoryChannels/index.tsx
// 部品(props だけ): 送るモーダルのカテゴリー(宛先で選べる物、D80)と、その経路の中の絞り(既定は全部オン)。
// 文言の無い経路には印を付ける(オンのままだと送る前に止まる)

"use client";

import { SoftBadge } from "@/components/Badge";
import { SelectInput, SwitchInput } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

export type SendCategoryChannelsProps = {
  categories: { key: string; label: string }[];
  category: string;
  onCategoryChange: (key: string) => void;
  channels: { key: string; label: string; on: boolean; blank: boolean }[];
  onToggleChannel: (key: string, on: boolean) => void;
};

export function SendCategoryChannels({ categories, category, onCategoryChange, channels, onToggleChannel }: SendCategoryChannelsProps) {
  return (
    <Stack space={3} data-slot="send-category-channels">
      <Stack space={1}>
        <Label htmlFor="send-category" className="text-sm">
          カテゴリー
        </Label>
        {categories.length === 0 ? (
          <Para size="sm" tone="muted" className="my-0">
            この宛先に送れるカテゴリーがありません
          </Para>
        ) : (
          <SelectInput
            id="send-category"
            value={category}
            options={categories.map((option) => ({ value: option.key, label: option.label }))}
            onChange={(v) => onCategoryChange(v ? String(v) : "")}
          />
        )}
      </Stack>
      <Stack space={1}>
        <Label className="text-sm">経路</Label>
        <Flex gap="sm" wrap="wrap">
          {channels.map((channel) => (
            <Flex key={channel.key} align="center" gap="xs">
              <SwitchInput size="sm" value={channel.on} onChange={(on) => onToggleChannel(channel.key, on)} label={channel.label} />
              {channel.on && channel.blank ? (
                <SoftBadge variant="warning" size="sm">
                  文言なし
                </SoftBadge>
              ) : null}
            </Flex>
          ))}
        </Flex>
      </Stack>
    </Stack>
  );
}
