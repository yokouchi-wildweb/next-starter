// src/features/core/messaging/components/common/SendCategoryChannels/index.tsx
// 部品(props だけ): 送るモーダルのカテゴリー(選んだ種別の物、D115。1 つしか無ければ選ばせず出さない)と、その経路の中の絞り(既定は全部オン)。
// blank の印は呼び手が文言の無い経路に付ける時だけ(省略 = 付けない)。種別の選び = SendKindPicker(このフォルダ)

"use client";

export { SendKindPicker, type SendKindPickerProps } from "./SendKindPicker";

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
  channels: { key: string; label: string; on: boolean; blank?: boolean }[];
  onToggleChannel: (key: string, on: boolean) => void;
};

export function SendCategoryChannels({ categories, category, onCategoryChange, channels, onToggleChannel }: SendCategoryChannelsProps) {
  return (
    <Stack space={3} data-slot="send-category-channels">
      {categories.length === 1 ? null : (
      <Stack space={1}>
        <Label htmlFor="send-category" className="text-sm">
          カテゴリー
        </Label>
        {categories.length === 0 ? (
          <Para size="sm" tone="muted" className="my-0">
            この種別に使えるカテゴリーがありません
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
      )}
      <Stack space={1}>
        <Label className="text-sm">送信方法</Label>
        <Flex gap="sm" wrap="wrap">
          {channels.map((channel) => (
            <Flex key={channel.key} align="center" gap="xs">
              <SwitchInput size="sm" value={channel.on} onChange={(on) => onToggleChannel(channel.key, on)} label={channel.label} />
              {channel.on && channel.blank ? (
                <SoftBadge variant="warning" size="sm">
                  未入力
                </SoftBadge>
              ) : null}
            </Flex>
          ))}
        </Flex>
      </Stack>
    </Stack>
  );
}
