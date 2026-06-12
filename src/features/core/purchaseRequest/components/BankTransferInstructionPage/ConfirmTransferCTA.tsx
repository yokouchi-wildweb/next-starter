// src/features/core/purchaseRequest/components/BankTransferInstructionPage/ConfirmTransferCTA.tsx
//
// ④ 振込完了申告セクション。
// クリックで ConfirmTransferModal（添付画像プレビュー + 不正注意 + 申告 API）を開く。
// ② の画像添付（+ AI 有効時は ③ の判定実施）まで disabled（親から制御）。
//
// AI 判定が不承認（judgmentFailed=true）の場合もボタンは活性化し、クリックで
// 直接申告モーダル（メモ入力必須バリアント）を開く。即時付与されない旨の注意喚起
// （UnverifiedSubmitNoticeDialog）は判定不承認の時点で親（index.tsx）が表示済み。

"use client";

import { useState } from "react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Button } from "@/components/Form/Button/Button";
import { Para, Span } from "@/components/TextBlocks";

import { ConfirmTransferModal } from "./ConfirmTransferModal";
import { circledNumber } from "./stepNumber";

type Props = {
  /** 親が動的に決定するステップ番号 (AI 判定有効時=4, 無効時=3) */
  step: number;
  /** purchase_request の ID（申告 API 呼び出しに使用） */
  requestId: string;
  /** ② で添付された画像の Storage URL。null = 未添付（ボタン非活性） */
  proofImageUrl: string | null;
  /** ボタンを非活性にする（画像未添付時など） */
  disabled?: boolean;
  /** disabled 時のボタンラベル。未指定時は通常ラベル「振込完了を申告する」を表示 */
  disabledLabel?: string;
  /**
   * AI 判定が不承認のまま申告するフローか（親が判定結果から算出）。
   * true の場合、申告モーダルでメモ入力が必須になる。
   */
  judgmentFailed?: boolean;
};

export function ConfirmTransferCTA({
  step,
  requestId,
  proofImageUrl,
  disabled = false,
  disabledLabel,
  judgmentFailed = false,
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
            {circledNumber(step)} 振込完了の申告
          </Span>
          <Para size="sm" tone="muted">
            {judgmentFailed
              ? "画像の検証が不承認のままでも申告できます。その場合は運営による入金確認後の付与となります。"
              : "振込が完了したら下のボタンから申告してください。"}
          </Para>
          <Flex justify="center">
            <Button
              type="button"
              variant={judgmentFailed ? "outline" : "default"}
              size="lg"
              className="w-full max-w-xs"
              onClick={handleClick}
              disabled={disabled}
            >
              {disabled && disabledLabel
                ? disabledLabel
                : judgmentFailed
                  ? "不承認のまま申告する"
                  : "振込完了を申告する"}
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
          judgmentFailed={judgmentFailed}
        />
      )}
    </>
  );
}
