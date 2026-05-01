// src/features/core/purchaseRequest/components/BankTransferInstructionPage/ConfirmTransferCTA.tsx
//
// ③ 振込完了申告セクション。
// クリックで ConfirmTransferModal（添付画像プレビュー + 不正注意 + 申告 API）を開く。
// ② で画像が添付されるまでは disabled（親から制御）。

"use client";

import { useState } from "react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Button } from "@/components/Form/Button/Button";
import { Para, Span } from "@/components/TextBlocks";

import { ConfirmTransferModal } from "./ConfirmTransferModal";

type Props = {
  /** purchase_request の ID（申告 API 呼び出しに使用） */
  requestId: string;
  /** ② で添付された画像の Storage URL。null = 未添付（ボタン非活性） */
  proofImageUrl: string | null;
  /** ボタンを非活性にする（画像未添付時など） */
  disabled?: boolean;
  /** disabled 時のボタンラベル。未指定時は通常ラベル「振込完了を申告する」を表示 */
  disabledLabel?: string;
};

export function ConfirmTransferCTA({
  requestId,
  proofImageUrl,
  disabled = false,
  disabledLabel,
}: Props) {
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    // 念のため: disabled が掛かっている時にプログラム的にクリックされた場合の防御
    if (proofImageUrl === null) return;
    setOpen(true);
  };

  return (
    <>
      <Block padding="md" className="rounded-lg border border-border bg-card">
        <Stack space={3}>
          <Span weight="semiBold" size="md">
            ③ 振込完了の申告
          </Span>
          <Para size="sm" tone="muted">
            振込が完了したら下のボタンから申告してください。
          </Para>
          <Flex justify="center">
            <Button
              type="button"
              variant="default"
              size="lg"
              className="w-full max-w-xs"
              onClick={handleClick}
              disabled={disabled}
            >
              {disabled && disabledLabel ? disabledLabel : "振込完了を申告する"}
            </Button>
          </Flex>
        </Stack>
      </Block>

      {proofImageUrl !== null && (
        <ConfirmTransferModal
          open={open}
          onOpenChange={setOpen}
          requestId={requestId}
          proofImageUrl={proofImageUrl}
        />
      )}
    </>
  );
}
