// src/domains/core/demo/types/bankTransferVision.ts
//
// 振込明細画像の判定デモ(/demo/bank-transfer-vision、API /api/demo/bank-transfer-vision)の入力と応答の型。

/** ストリクトモード時の必須 3 点チェックの個別結果（lib/aiVision の BankTransferStrictChecks と同期） */
export type DemoStrictChecks = {
  senderNameConfirmed: boolean;
  identifierConfirmed: boolean;
  amountConfirmed: boolean;
  detectedSenderName: string | null;
};

export type DemoJudgmentResult = {
  isLikelyBankTransfer: boolean;
  confidence: number;
  imageType: "photo" | "screenshot" | "other";
  reason: string;
  /** ストリクトモード時のみ付与される */
  strictChecks?: DemoStrictChecks;
};

export type DemoJudgeInput = {
  file: File;
  /** 渡すとストリクトモード(振込人名・識別数字・金額の 3 点確認)で判定する */
  strict?: { expectedIdentifier: string; expectedAmount: number };
};
