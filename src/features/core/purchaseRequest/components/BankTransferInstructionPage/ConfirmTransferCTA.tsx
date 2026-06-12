// src/features/core/purchaseRequest/components/BankTransferInstructionPage/ConfirmTransferCTA.tsx
//
// ④ 振込完了申告セクション。
// クリックで ConfirmTransferModal（添付画像プレビュー + 不正注意 + 申告 API）を開く。
// ② の画像添付（+ AI 有効時は ③ の判定実施）まで disabled（親から制御）。
//
// AI 判定が不承認（judgmentFailed=true）の場合もボタンは活性化するが、
// 先に UnverifiedSubmitNoticeDialog（即時付与されない旨の注意喚起）を挟んでから
// 申告モーダルを開く。申告モーダル側では振込人名等メモの入力が必須になる。

"use client";

import { useState } from "react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Button } from "@/components/Form/Button/Button";
import { Para, Span } from "@/components/TextBlocks";

import { ConfirmTransferModal } from "./ConfirmTransferModal";
import { UnverifiedSubmitNoticeDialog } from "./UnverifiedSubmitNoticeDialog";
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
   * true の場合、注意喚起ダイアログを挟み、申告モーダルでメモ入力が必須になる。
   */
  judgmentFailed?: boolean;
  /** 通貨の表示名（例: コイン、ポイント）。不承認時の注意文言に使用 */
  currencyLabel: string;
};

export function ConfirmTransferCTA({
  step,
  requestId,
  proofImageUrl,
  disabled = false,
  disabledLabel,
  judgmentFailed = false,
  currencyLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);

  const handleClick = () => {
    // 念のため: disabled が掛かっている時にプログラム的にクリックされた場合の防御
    if (proofImageUrl === null) return;
    if (judgmentFailed) {
      // 不承認のままの申告は、先に注意喚起（即時付与されない旨）を挟む
      setNoticeOpen(true);
      return;
    }
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

      {/* 不承認申告フローの注意喚起（了解で申告モーダルへ） */}
      <UnverifiedSubmitNoticeDialog
        open={noticeOpen}
        onOpenChange={setNoticeOpen}
        onProceed={() => setOpen(true)}
        currencyLabel={currencyLabel}
      />

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
