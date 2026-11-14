// src/features/core/messaging/components/UnsubscribeConfirm/index.tsx
// 部品(props だけ): 配信停止の確認(止める種類と経路・「配信を停止する」ボタン・失敗の文)。押すと onConfirm

"use client";

import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Para } from "@/components/TextBlocks/Para";

export type UnsubscribeConfirmProps = {
  /** 止める種類の表示名 */
  categoryLabel: string;
  /** 止める経路の表示名 */
  channelLabel: string;
  onConfirm: () => void;
  /** 送っている最中(押せない、ボタンに spinner) */
  pending?: boolean;
  /** 失敗の文(null = 出さない) */
  errorText?: string | null;
};

export function UnsubscribeConfirm({ categoryLabel, channelLabel, onConfirm, pending = false, errorText = null }: UnsubscribeConfirmProps) {
  return (
    <Stack space={4}>
      <Para>
        「{categoryLabel}」の{channelLabel}の配信を停止します。
      </Para>
      {errorText ? <Para tone="destructive">{errorText}</Para> : null}
      <Flex justify="center">
        <Button type="button" onClick={onConfirm} disabled={pending}>
          {pending ? <Spinner className="size-4" /> : null}
          配信を停止する
        </Button>
      </Flex>
    </Stack>
  );
}
