// src/features/core/purchaseRequest/components/BankTransferInstructionPage/UnverifiedSubmitNoticeDialog.tsx
//
// AI 画像判定が不承認のままユーザーが申告に進もうとしたときに表示する注意喚起ダイアログ。
// 「即時付与されないこと」「画像の再添付 or 手動確認の 2 つの選択肢があること」を
// 申告モーダルを開く前に必ず伝える。
// 「了解して申告に進む」で onProceed が呼ばれ、親（ConfirmTransferCTA）が
// 申告モーダル（ConfirmTransferModal の不承認バリアント）を開く。

"use client";

import { AlertTriangle } from "lucide-react";

import { Stack } from "@/components/Layout/Stack";
import { Dialog } from "@/components/Overlays/Dialog";
import { Para, Span } from "@/components/TextBlocks";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 「了解して申告に進む」押下時。親側で申告モーダルを開く */
  onProceed: () => void;
  /** 通貨の表示名（例: コイン、ポイント）。注意文言に埋め込む */
  currencyLabel: string;
};

export function UnverifiedSubmitNoticeDialog({
  open,
  onOpenChange,
  onProceed,
  currencyLabel,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <Span weight="semiBold" size="md" tone="destructive">
          <AlertTriangle
            aria-hidden
            className="mr-1.5 inline-block h-5 w-5 align-text-bottom"
          />
          申告前の重要なご確認
        </Span>
      }
      titleAlign="center"
      cancelLabel="戻る"
      confirmLabel="了解して申告に進む"
      onConfirm={() => {
        onOpenChange(false);
        onProceed();
      }}
      footerAlign="center"
    >
      <Stack space={3}>
        <Para size="sm" align="center" className="leading-relaxed">
          振込人名・識別数字・金額の確認ができないため、
          <Span size="sm" weight="semiBold" tone="destructive">
            {currencyLabel}は即時付与されません。
          </Span>
        </Para>
        <Para size="sm" align="center" className="leading-relaxed">
          3点が確認できる画像をお持ちの場合は、
          <br />
          画像を添付し直して再度判定を行ってください。
        </Para>
        <Para size="sm" align="center" className="leading-relaxed">
          誤ったお名前でお振込みをされた場合などは、
          <br />
          運営にてご入金の確認を手動で行います。
          <br />
          次の画面で、ご入金の確認が取れる
          <br />
          振込人名等の情報をご記載ください。
        </Para>
      </Stack>
    </Dialog>
  );
}
