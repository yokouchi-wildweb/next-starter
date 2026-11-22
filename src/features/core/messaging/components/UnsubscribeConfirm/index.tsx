// src/features/core/messaging/components/UnsubscribeConfirm/index.tsx
// 部品(props だけ): 配信停止の確認(止めるカテゴリーと送信チャンネル・「配信を停止する」ボタン・失敗の文)。押すと onConfirm

"use client";

import { Button } from "@/components/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

export type UnsubscribeConfirmProps = {
  /** 止めるカテゴリーの表示名 */
  categoryLabel: string;
  /** 止める送信チャンネルの表示名 */
  channelLabel: string;
  onConfirm: () => void;
  /** 送っている最中(押せない、ボタンに spinner) */
  pending?: boolean;
  /** 失敗の文(null = 出さない) */
  errorText?: string | null;
};

export function UnsubscribeConfirm({ categoryLabel, channelLabel, onConfirm, pending = false, errorText = null }: UnsubscribeConfirmProps) {
  return (
    <Stack gap="md">
      <Para>
        「{categoryLabel}」の{channelLabel}の配信を停止します。
      </Para>
      {errorText ? <Para tone="destructive">{errorText}</Para> : null}
      <Flex justify="center">
        <Button type="button" onClick={onConfirm} loading={pending}>
          配信を停止する
        </Button>
      </Flex>
    </Stack>
  );
}
