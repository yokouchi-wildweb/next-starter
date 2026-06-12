// src/features/core/purchaseRequest/constants/bankTransferJudgment.ts
//
// 銀行振込明細画像の AI 判定に関する共有定数・型。
// client（ImageJudgmentSection 等）と server（judge-image / submitReview）の
// 双方から import されるため "use client" を付けない中立モジュールとして維持すること。
//
// 判定結果は judge-image API 実行時に purchase_requests.metadata（jsonb）へ
// BANK_TRANSFER_JUDGMENT_METADATA_KEY をキーとして保存され、振込完了申告
// （submitReview）でサーバー側の合否検証に使われる。クライアントの自己申告には
// 依存しない（API 直叩きで判定をバイパスして即時付与を受ける攻撃の防止）。

import type {
  BankTransferReceiptImageType,
  BankTransferStrictChecks,
} from "@/lib/aiVision";

/**
 * 通過判定の最小確信度。
 * isLikelyBankTransfer=true かつ confidence がこの値以上で「合格」。
 * サーバー側（judge-image）で合否を確定し、UI はサーバーが返す passed を表示に使う。
 */
export const BANK_TRANSFER_JUDGMENT_PASS_THRESHOLD = 35;

/** purchase_requests.metadata 内で判定レコードを保持するキー。 */
export const BANK_TRANSFER_JUDGMENT_METADATA_KEY = "bankTransferImageJudgment";

/**
 * purchase_requests.metadata に保存する判定レコード。
 * 同一 purchase_request で再判定された場合は最新の 1 件で上書きされる
 * （履歴は監査ログ・レート制限側に残る情報で十分という方針）。
 */
export type BankTransferImageJudgmentRecord = {
  /** サーバー側で確定した合否（isLikelyBankTransfer && confidence >= 閾値） */
  passed: boolean;
  isLikelyBankTransfer: boolean;
  confidence: number;
  imageType: BankTransferReceiptImageType;
  /** AI が生成した日本語の判定根拠（お客様向け文面） */
  reason: string;
  /** ストリクトモード時のみ。3 点確認の個別結果 */
  strictChecks?: BankTransferStrictChecks | null;
  /** この判定がストリクトモードで行われたか */
  strictMode: boolean;
  /** 判定実行日時（ISO 8601） */
  judgedAt: string;
};

/**
 * AI 判定結果から合否を計算する。合否ロジックの単一の定義箇所。
 */
export function isBankTransferJudgmentPassed(result: {
  isLikelyBankTransfer: boolean;
  confidence: number;
}): boolean {
  return (
    result.isLikelyBankTransfer &&
    result.confidence >= BANK_TRANSFER_JUDGMENT_PASS_THRESHOLD
  );
}

/**
 * purchase_requests.metadata（任意形の jsonb）から判定レコードを安全に取り出す。
 * 未判定・形不正の場合は null（呼び出し側は「未判定 = 不合格」として扱う）。
 */
export function readBankTransferJudgmentFromMetadata(
  metadata: unknown,
): BankTransferImageJudgmentRecord | null {
  if (typeof metadata !== "object" || metadata === null) return null;
  const record = (metadata as Record<string, unknown>)[
    BANK_TRANSFER_JUDGMENT_METADATA_KEY
  ];
  if (typeof record !== "object" || record === null) return null;
  const candidate = record as Record<string, unknown>;
  if (
    typeof candidate.passed !== "boolean" ||
    typeof candidate.isLikelyBankTransfer !== "boolean" ||
    typeof candidate.confidence !== "number"
  ) {
    return null;
  }
  return record as BankTransferImageJudgmentRecord;
}
