// src/lib/aiVision/bankTransferReceipt.ts

import "server-only";

import { getAnthropicClient } from "./client";
import { BANK_TRANSFER_RECEIPT_PROMPT } from "./prompts";

/**
 * Anthropic Vision API が受け付ける画像 MIME タイプ。
 */
export type SupportedImageMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

export type CheckBankTransferReceiptInput = {
  /** Base64 エンコード済み画像データ（data URL プレフィックスなし） */
  imageBase64: string;
  /** 画像の MIME タイプ */
  mediaType: SupportedImageMediaType;
};

export type BankTransferReceiptImageType = "photo" | "screenshot" | "other";

export type CheckBankTransferReceiptResult = {
  /** 振込明細写真 or ネットバンク振込完了画面と見えるか */
  isLikelyBankTransfer: boolean;
  /** AI の確信度（0-100） */
  confidence: number;
  /** 画像種別の推定 */
  imageType: BankTransferReceiptImageType;
  /** 判定根拠の日本語短文 */
  reason: string;
};

/** 利用モデル（Haiku 4.5）。チューニングで差し替える場合はここを変更。 */
const MODEL = "claude-haiku-4-5-20251001";

/** Tool use で structured output を強制する。自由文返却を避けてパース失敗ゼロに。 */
const REPORT_TOOL = {
  name: "report_judgment",
  description: "銀行振込画像の事前判定結果を構造化して返す",
  input_schema: {
    type: "object" as const,
    properties: {
      isLikelyBankTransfer: {
        type: "boolean",
        description: "振込明細写真またはネットバンク振込完了画面と見えるなら true",
      },
      confidence: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "判定の確信度（0-100）",
      },
      imageType: {
        type: "string",
        enum: ["photo", "screenshot", "other"],
        description: "photo=写真撮影、screenshot=スクリーンショット、other=それ以外",
      },
      reason: {
        type: "string",
        description: "判定根拠の日本語短文（80文字以内目安）",
      },
    },
    required: ["isLikelyBankTransfer", "confidence", "imageType", "reason"],
  },
};

/**
 * 画像が銀行振込関連かどうかをざっくり判定します。
 *
 * 仮判定用途のため、金額や振込先の一致までは検証しません。
 * 明らかに無関係な画像（自撮り・他アプリ画面など）を弾くことが目的です。
 *
 * @throws Anthropic API のエラー、または ANTHROPIC_API_KEY 未設定時
 */
export async function checkBankTransferReceipt(
  input: CheckBankTransferReceiptInput,
): Promise<CheckBankTransferReceiptResult> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    tools: [REPORT_TOOL],
    tool_choice: { type: "tool", name: REPORT_TOOL.name },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: input.mediaType,
              data: input.imageBase64,
            },
          },
          {
            type: "text",
            text: BANK_TRANSFER_RECEIPT_PROMPT,
          },
        ],
      },
    ],
  });

  const toolUseBlock = response.content.find((block) => block.type === "tool_use");
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error(
      "AI が判定結果を返しませんでした（tool_use ブロックなし）",
    );
  }

  const raw = toolUseBlock.input as Partial<CheckBankTransferReceiptResult>;

  if (
    typeof raw.isLikelyBankTransfer !== "boolean" ||
    typeof raw.confidence !== "number" ||
    typeof raw.imageType !== "string" ||
    typeof raw.reason !== "string"
  ) {
    throw new Error("AI の判定結果のフォーマットが想定外です");
  }

  return {
    isLikelyBankTransfer: raw.isLikelyBankTransfer,
    confidence: Math.max(0, Math.min(100, Math.round(raw.confidence))),
    imageType: normalizeImageType(raw.imageType),
    reason: raw.reason,
  };
}

function normalizeImageType(value: string): BankTransferReceiptImageType {
  if (value === "photo" || value === "screenshot") {
    return value;
  }
  return "other";
}
