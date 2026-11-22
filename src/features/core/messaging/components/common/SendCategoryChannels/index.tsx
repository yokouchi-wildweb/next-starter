// src/features/core/messaging/components/common/SendCategoryChannels/index.tsx
// 部品(props だけ): 送るモーダルのカテゴリー(選んだ種別の物、D115。1 つしか無ければ選ばせず出さない)と、その送信チャンネルの中の絞り(既定は全部オン)。
// blank の印は呼び手が文言の無い送信チャンネルに付ける時だけ(省略 = 付けない)。種別の選び = SendKindPicker(このフォルダ)

"use client";

export { SendKindPicker, type SendKindPickerProps } from "./SendKindPicker";

import { SoftBadge } from "@/components/Badge/SoftBadge";
import { Check } from "lucide-react";

import { Button } from "@/components/Button/Button";
import { SelectInput } from "@/components/Input/Select";
import { Label } from "@/components/Input/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { cn } from "@/lib/cn";

export type SendCategoryChannelsProps = {
  categories: { key: string; label: string }[];
  category: string;
  onCategoryChange: (key: string) => void;
  channels: { key: string; label: string; on: boolean; blank?: boolean }[];
  onToggleChannel: (key: string, on: boolean) => void;
  /** カテゴリーの選択を出すか(既定 true。種別と 1 行の KindCategoryFields で選ぶ画面は false、D118) */
  showCategory?: boolean;
  /** 「送信方法」の見出しを見た目から隠す(読み上げには残す)。呼び手が行の見出しを持つ時 */
  hideChannelLabel?: boolean;
};

export function SendCategoryChannels({
  categories,
  category,
  onCategoryChange,
  channels,
  onToggleChannel,
  showCategory = true,
  hideChannelLabel = false,
}: SendCategoryChannelsProps) {
  return (
    <Stack gap="sm" data-slot="send-category-channels">
      {!showCategory || categories.length === 1 ? null : (
      <Stack gap="2xs">
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
      <Stack gap="2xs">
        <Span size="sm" weight="medium" className={hideChannelLabel ? "sr-only" : undefined} id="send-channels-label">
          送信方法
        </Span>
        {/* 送信チャンネル = 押すと入り切りする丸い札(入 = primary の薄い地 + ✓)。文言の無い送信チャンネルは札の中に「未入力」 */}
        <Flex gap="xs" wrap="wrap" role="group" aria-labelledby="send-channels-label">
          {channels.map((channel) => (
            <Button
              key={channel.key}
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={channel.on}
              className={cn(
                "h-8 gap-1.5 rounded-full px-3 font-normal",
                channel.on ? "border-primary/60 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary" : "text-muted-foreground",
              )}
              onClick={() => onToggleChannel(channel.key, !channel.on)}
              data-slot="send-channel"
            >
              {channel.on ? <Check className="size-3.5" aria-hidden /> : null}
              {channel.label}
              {channel.on && channel.blank ? (
                <SoftBadge variant="warning" size="sm" className="ml-0.5">
                  未入力
                </SoftBadge>
              ) : null}
            </Button>
          ))}
        </Flex>
      </Stack>
    </Stack>
  );
}
