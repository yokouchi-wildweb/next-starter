// src/features/core/purchaseRequest/types/bankTransferJudgment.ts
//
// 振込明細画像の AI 事前判定(/api/wallet/purchase/[id]/bank-transfer/judge-image)の応答の型。
// 判定の部品(ImageJudgmentSection)・フック(useBankTransferImageJudge)・クライアント(purchaseRequestClient)が共有する。

export type RateLimitInfo = {
  /** 直近15分の残り失敗許容回数 */
  remainingFailures15m: number;
  /** 直近24時間の残り試行可能回数（UI には出さないが 429 判断に使う） */
  remainingAttempts24h: number;
  resetAt15m: string | null;
  resetAt24h: string | null;
};

/**
 * ストリクトモード時の必須 3 点チェックの個別結果。
 * サーバー側 (lib/aiVision) の BankTransferStrictChecks と同期。
 */
export type StrictChecks = {
  /** 振込人名が明細内で読み取れたか */
  senderNameConfirmed: boolean;
  /** 振込人名の前後どちらかに識別数字があるか */
  identifierConfirmed: boolean;
  /** 振込金額が一致したか */
  amountConfirmed: boolean;
  /** 読み取れた振込人名（読み取れなかった場合は null） */
  detectedSenderName: string | null;
};

export type JudgmentResult = {
  /**
   * サーバー側で確定した合否（isLikelyBankTransfer && confidence >= 閾値）。
   * 閾値の定義は purchaseRequest/constants/bankTransferJudgment.ts に集約されている。
   */
  passed: boolean;
  isLikelyBankTransfer: boolean;
  confidence: number;
  imageType: "photo" | "screenshot" | "other";
  reason: string;
  /** ストリクトモード時のみ付与される */
  strictChecks?: StrictChecks;
  rateLimit: RateLimitInfo;
};
