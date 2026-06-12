// src/features/core/purchaseRequest/components/BankTransferInstructionPage/UnverifiedSubmitNoticeDialog.tsx
//
// AI 画像判定が「不承認」になった直後に自動表示する注意喚起ダイアログ。
// 「即時付与されないこと」「画像の再添付 or 手動確認の 2 つの選択肢があること」を
// 判定結果を見たタイミングで必ず伝える（親 index.tsx が不承認の判定結果を受け取った
// 時点で open にする。再判定で再び不承認になった場合も都度表示する）。
// 申告ボタン（不承認のまま申告する）からは本ダイアログを経由せず、
// 直接 ConfirmTransferModal（メモ入力必須）が開く。

"use client";

import { AlertTriangle } from "lucide-react";

import { Stack } from "@/components/Layout/Stack";
import { Dialog } from "@/components/Overlays/Dialog";
import { Para, Span } from "@/components/TextBlocks";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 通貨の表示名（例: コイン、ポイント）。注意文言に埋め込む */
  currencyLabel: string;
};

export function UnverifiedSubmitNoticeDialog({
  open,
  onOpenChange,
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
          画像判定が不承認となりました
        </Span>
      }
      titleAlign="center"
      showCancelButton={false}
      confirmLabel="確認しました"
      onConfirm={() => onOpenChange(false)}
      footerAlign="center"
    >
      <Stack space={3}>
        <Para size="sm" align="center" className="leading-relaxed">
          振込人名・識別数字・金額の確認ができないため<br />
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
          「不承認のまま申告する」へ進み、ご入金の確認が
          <br />
          取れる振込人名等の情報をご記載ください。
        </Para>
      </Stack>
    </Dialog>
  );
}
