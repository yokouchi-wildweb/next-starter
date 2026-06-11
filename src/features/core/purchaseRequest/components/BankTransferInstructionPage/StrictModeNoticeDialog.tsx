// src/features/core/purchaseRequest/components/BankTransferInstructionPage/StrictModeNoticeDialog.tsx
//
// ストリクトモード時にページ入場時点で自動表示する注意喚起ダイアログ。
// 「振込人名・識別番号・金額の 3 点が確認できないと即時付与されない」ことを
// 振込前に伝え、3 点が写った明細画像の準備を促す。
// 親 (index.tsx) がストリクトモード有効時のみマウントする。
// ブックマーク再訪時にも表示する（明細画像の準備が必要という注意は再訪時も有効なため）。

"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Stack } from "@/components/Layout/Stack";
import { Dialog } from "@/components/Overlays/Dialog";
import { Para, Span } from "@/components/TextBlocks";

type Props = {
  /** 通貨の表示名（例: コイン、ポイント）。注意文言に埋め込む */
  currencyLabel: string;
};

export function StrictModeNoticeDialog({ currencyLabel }: Props) {
  // 入場時に必ず開く。閉じたらこのマウント中は再表示しない。
  const [open, setOpen] = useState(true);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={
        <Span weight="semiBold" size="md" tone="destructive">
          <AlertTriangle
            aria-hidden
            className="mr-1.5 inline-block h-5 w-5 align-text-bottom"
          />
          振込前の重要なご確認
        </Span>
      }
      titleAlign="center"
      showCancelButton={false}
      confirmLabel="確認しました"
      onConfirm={() => setOpen(false)}
      footerAlign="center"
    >
      <Stack space={3}>
        <Para size="sm" align="center" className="leading-relaxed">
          振込人名・識別番号・金額が誤っている場合や
          <br />
          確認が取れない場合は、
          <Span size="sm" weight="semiBold" tone="destructive">
            {currencyLabel}が即時付与されません。
          </Span>
        </Para>
        <Para size="sm" align="center" className="leading-relaxed">
          振込時のお名前にご注意のうえ、
          <br />
          上記が確認できるスクリーンショットや明細を
          <br />
          必ずご用意ください。
        </Para>
      </Stack>
    </Dialog>
  );
}
