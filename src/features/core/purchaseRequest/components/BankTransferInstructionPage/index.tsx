// src/features/core/purchaseRequest/components/BankTransferInstructionPage/index.tsx
//
// 自社受付の銀行振込（inhouse プロバイダ）の振込案内ページ UI 本体。
// SSR で検証済みの purchase_request 情報を props として受け取り、
// ユーザーが振込を完了して申告するまでの操作手順を表示する。
//
// 振込完了モーダル / 画面保存モーダルは次工程で実装予定（CTA はスタブ）。

"use client";

import { useState } from "react";

import { Stack } from "@/components/Layout/Stack";
import type { BankTransferConfig } from "@/config/app/payment.config";

import { AccountInfoCard } from "./AccountInfoCard";
import { AmountDisplay } from "./AmountDisplay";
import { ConfirmTransferCTA } from "./ConfirmTransferCTA";
import { PrepareProofImage } from "./PrepareProofImage";
import { SaveBookmarkButton } from "./SaveBookmarkButton";
import { StepConnector } from "./StepConnector";

export type BankTransferInstructionPageProps = {
  /** purchase_request の ID（画像アップロードのパスに使用） */
  requestId: string;
  /** 振込金額（円） */
  paymentAmount: number;
  /** 振込先口座情報（① のモーダル内で表示） */
  account: BankTransferConfig["account"];
  /** 振込人名末尾に付与する識別子（① のモーダル内で表示） */
  identifier: string;
  /** 振込期限。null の場合は表示しない */
  expiresAt: Date | null;
};

export function BankTransferInstructionPage({
  requestId,
  paymentAmount,
  account,
  identifier,
  expiresAt,
}: BankTransferInstructionPageProps) {
  // ② で添付された画像の Storage URL。null = 未添付。
  // 添付されると ③ の CTA が活性化する。
  const [proofImageUrl, setProofImageUrl] = useState<string | null>(null);

  return (
    <Stack space={5}>
      {/* 振込金額 */}
      <AmountDisplay amount={paymentAmount} />

      {/* この画面を保存（再訪用導線） */}
      <SaveBookmarkButton />

      {/* ① 振込先口座（期限表示も内包、ボタンクリックで詳細モーダル展開） */}
      <AccountInfoCard account={account} identifier={identifier} expiresAt={expiresAt} />

      <StepConnector />

      {/* ② 振込明細の画像を用意（OS ネイティブシートで取得 → 即時アップロード） */}
      <PrepareProofImage
        requestId={requestId}
        imageUrl={proofImageUrl}
        onChange={setProofImageUrl}
      />

      <StepConnector />

      {/* ③ 振込完了の申告 */}
      <ConfirmTransferCTA
        requestId={requestId}
        proofImageUrl={proofImageUrl}
        disabled={proofImageUrl === null}
        disabledLabel="先に画像を添付してください"
      />
    </Stack>
  );
}
