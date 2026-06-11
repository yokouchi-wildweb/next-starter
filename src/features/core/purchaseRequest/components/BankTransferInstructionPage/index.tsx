// src/features/core/purchaseRequest/components/BankTransferInstructionPage/index.tsx
//
// 自社受付の銀行振込（inhouse プロバイダ）の振込案内ページ UI 本体。
// SSR で検証済みの purchase_request 情報を props として受け取り、
// ユーザーが振込を完了して申告するまでの操作手順を表示する。
//
// aiImageJudgmentEnabled フラグで構成が切り替わる:
// - true:  ① 口座 → ② 画像 → ③ AI 判定 → ④ 申告
// - false: ① 口座 → ② 画像 → ③ 申告（AI 判定セクション非表示）
// ステップ番号は親で動的計算し、各セクションに step props で渡す。

"use client";

import { useState } from "react";

import { Stack } from "@/components/Layout/Stack";
import type { BankTransferConfig } from "@/config/app/payment.config";

import { AccountInfoCard } from "./AccountInfoCard";
import { AmountDisplay } from "./AmountDisplay";
import { CancelTransferButton } from "./CancelTransferButton";
import { ConfirmTransferCTA } from "./ConfirmTransferCTA";
import {
  ImageJudgmentSection,
  isJudgmentPassed,
  type JudgmentResult,
} from "./ImageJudgmentSection";
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
  /**
   * AI 画像判定ステップの有効化フラグ。
   * SSR ページから paymentConfig.bankTransfer.aiImageJudgmentEnabled が渡る。
   */
  aiImageJudgmentEnabled: boolean;
  /**
   * AI 判定のストリクトモードフラグ（説明文の切替用）。
   * SSR ページから paymentConfig.bankTransfer.aiImageJudgmentStrictMode が渡る。
   * 実際の厳格判定はサーバー側（judge-image API）で行われる。
   */
  aiImageJudgmentStrictMode: boolean;
};

export function BankTransferInstructionPage({
  requestId,
  paymentAmount,
  account,
  identifier,
  expiresAt,
  aiImageJudgmentEnabled,
  aiImageJudgmentStrictMode,
}: BankTransferInstructionPageProps) {
  // 添付された画像の Storage URL。null = 未添付。申告ステップ API に渡す。
  const [proofImageUrl, setProofImageUrl] = useState<string | null>(null);
  // 選択された画像 File。AI 判定 API へ multipart で送るために保持（AI 有効時のみ使用）。
  const [proofImageFile, setProofImageFile] = useState<File | null>(null);
  // AI 判定結果。null = 未判定。AI 有効時のみ申告ステップの活性条件として参照する。
  const [judgmentResult, setJudgmentResult] = useState<JudgmentResult | null>(null);

  const handleImageChange = (url: string | null, file: File | null) => {
    setProofImageUrl(url);
    setProofImageFile(file);
    // 画像差し替え・削除時は判定結果をリセット（再判定を強制）
    setJudgmentResult(null);
  };

  // ステップ番号を動的計算: AI 判定セクションの有無で申告ステップが 3 または 4 になる。
  let stepCounter = 0;
  const accountStep = ++stepCounter;
  const prepareImageStep = ++stepCounter;
  const judgmentStep = aiImageJudgmentEnabled ? ++stepCounter : null;
  const confirmStep = ++stepCounter;

  // 申告ボタン活性条件: AI 有効時は判定通過、無効時は画像添付済みのみ。
  const canSubmit = aiImageJudgmentEnabled
    ? isJudgmentPassed(judgmentResult)
    : proofImageUrl !== null;

  const submitDisabledLabel = ((): string | undefined => {
    if (proofImageUrl === null) return "先に画像を添付してください";
    if (!aiImageJudgmentEnabled) return undefined; // 画像済みなら active
    if (judgmentResult === null) return "先に画像の判定を行ってください";
    return "画像の検証が不承認です";
  })();

  return (
    <Stack space={5}>
      {/* 振込金額 */}
      <AmountDisplay amount={paymentAmount} />

      {/* この画面を保存（再訪用導線） */}
      <SaveBookmarkButton />

      {/* 振込先口座（期限表示も内包、ボタンクリックで詳細モーダル展開） */}
      <AccountInfoCard
        step={accountStep}
        account={account}
        identifier={identifier}
        expiresAt={expiresAt}
      />

      <StepConnector />

      {/* 振込明細の画像を用意（OS ネイティブシートで取得 → 即時アップロード） */}
      <PrepareProofImage
        step={prepareImageStep}
        requestId={requestId}
        imageUrl={proofImageUrl}
        onChange={handleImageChange}
      />

      <StepConnector />

      {/* AI による画像の事前判定（フラグ有効時のみ） */}
      {aiImageJudgmentEnabled && judgmentStep !== null && (
        <>
          <ImageJudgmentSection
            step={judgmentStep}
            requestId={requestId}
            file={proofImageFile}
            result={judgmentResult}
            onResultChange={setJudgmentResult}
            strictMode={aiImageJudgmentStrictMode}
          />
          <StepConnector />
        </>
      )}

      {/* 振込完了の申告（AI 有効時は判定通過後のみ活性化） */}
      <ConfirmTransferCTA
        step={confirmStep}
        requestId={requestId}
        proofImageUrl={proofImageUrl}
        disabled={!canSubmit}
        disabledLabel={submitDisabledLabel}
      />

      {/* 最下部: 振込による購入をキャンセル（不可逆 / Dialog で確認） */}
      <CancelTransferButton requestId={requestId} />
    </Stack>
  );
}
