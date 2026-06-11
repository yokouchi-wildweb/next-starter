// src/lib/aiVision/bankTransferReceipt.ts

import "server-only";

import { getAnthropicClient } from "./client";
import {
  BANK_TRANSFER_RECEIPT_PROMPT,
  buildBankTransferReceiptStrictPrompt,
  type BankTransferStrictExpectation,
} from "./prompts";

export type { BankTransferStrictExpectation } from "./prompts";

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
  /**
   * 指定するとストリクトモード判定になる。
   * 振込人名・識別数字・振込金額の 3 点が明細内で確認できなければ不合格。
   */
  strict?: BankTransferStrictExpectation;
};

export type BankTransferReceiptImageType = "photo" | "screenshot" | "other";

/**
 * ストリクトモードの必須 3 点チェックの個別結果。
 * UI で「どの項目が原因で不合格か」を提示するために使う。
 */
export type BankTransferStrictChecks = {
  /** 振込人名が明細内で読み取れたか */
  senderNameConfirmed: boolean;
  /** 振込人名の前後どちらかに期待値と一致する識別数字があるか */
  identifierConfirmed: boolean;
  /** 振込金額が期待値と一致するか */
  amountConfirmed: boolean;
  /** 読み取れた振込人名（読み取れなかった場合は null） */
  detectedSenderName: string | null;
};

export type CheckBankTransferReceiptResult = {
  /**
   * 振込明細写真 or ネットバンク振込完了画面と見えるか。
   * ストリクトモード時は「明細らしい かつ 3 点チェックすべて合格」のときのみ true。
   */
  isLikelyBankTransfer: boolean;
  /** AI の確信度（0-100） */
  confidence: number;
  /** 画像種別の推定 */
  imageType: BankTransferReceiptImageType;
  /** 判定根拠の日本語短文 */
  reason: string;
  /** ストリクトモード時のみ。3 点チェックの個別結果 */
  strictChecks?: BankTransferStrictChecks;
};

/** 利用モデル（Haiku 4.5）。チューニングで差し替える場合はここを変更。 */
const MODEL = "claude-haiku-4-5-20251001";

/** 通常・ストリクト共通の判定結果プロパティ。 */
const REPORT_TOOL_BASE_PROPERTIES = {
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
    description:
      "お客様にそのまま表示する判定理由。丁寧語（です・ます調）で1〜2文・80文字以内目安",
  },
} as const;

/** Tool use で structured output を強制する。自由文返却を避けてパース失敗ゼロに。 */
const REPORT_TOOL = {
  name: "report_judgment",
  description: "銀行振込画像の事前判定結果を構造化して返す",
  input_schema: {
    type: "object" as const,
    properties: REPORT_TOOL_BASE_PROPERTIES,
    required: ["isLikelyBankTransfer", "confidence", "imageType", "reason"],
  },
};

/** ストリクトモード用ツール。必須 3 点チェックの個別結果も報告させる。 */
const REPORT_TOOL_STRICT = {
  name: "report_judgment",
  description: "銀行振込画像の厳格判定結果（必須3点チェック含む）を構造化して返す",
  input_schema: {
    type: "object" as const,
    properties: {
      ...REPORT_TOOL_BASE_PROPERTIES,
      senderNameConfirmed: {
        type: "boolean",
        description: "振込人名（依頼人名等の欄）が明細内で明確に読み取れたら true",
      },
      detectedSenderName: {
        type: "string",
        description: "読み取れた振込人名（識別数字は除く）。読み取れなければ空文字",
      },
      identifierConfirmed: {
        type: "boolean",
        description: "振込人名の直前または直後に、指定された識別数字が完全一致で付与されていたら true",
      },
      amountConfirmed: {
        type: "boolean",
        description: "振込金額が指定された金額と一致していたら true",
      },
    },
    required: [
      "isLikelyBankTransfer",
      "confidence",
      "imageType",
      "reason",
      "senderNameConfirmed",
      "detectedSenderName",
      "identifierConfirmed",
      "amountConfirmed",
    ],
  },
};

/** ストリクトモード時に AI が追加で返すフィールドの生値。 */
type RawStrictFields = {
  senderNameConfirmed?: unknown;
  detectedSenderName?: unknown;
  identifierConfirmed?: unknown;
  amountConfirmed?: unknown;
};

/**
 * 画像が銀行振込関連かどうかを判定します。
 *
 * 通常モード（strict 未指定）:
 * 仮判定用途のため、金額や振込先の一致までは検証しません。
 * 明らかに無関係な画像（自撮り・他アプリ画面など）を弾くことが目的です。
 *
 * ストリクトモード（strict 指定）:
 * 明細内で「振込人名・名前の前後の識別数字・振込金額」の 3 点すべてが
 * 確認できたときのみ isLikelyBankTransfer=true を返します。
 * 個別の合否は strictChecks に格納されます。
 *
 * @throws Anthropic API のエラー、または ANTHROPIC_API_KEY 未設定時
 */
export async function checkBankTransferReceipt(
  input: CheckBankTransferReceiptInput,
): Promise<CheckBankTransferReceiptResult> {
  const client = getAnthropicClient();

  const isStrict = input.strict !== undefined;
  const tool = isStrict ? REPORT_TOOL_STRICT : REPORT_TOOL;
  const prompt = isStrict
    ? buildBankTransferReceiptStrictPrompt(input.strict!)
    : BANK_TRANSFER_RECEIPT_PROMPT;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
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
            text: prompt,
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

  const raw = toolUseBlock.input as Partial<CheckBankTransferReceiptResult> &
    RawStrictFields;

  if (
    typeof raw.isLikelyBankTransfer !== "boolean" ||
    typeof raw.confidence !== "number" ||
    typeof raw.imageType !== "string" ||
    typeof raw.reason !== "string"
  ) {
    throw new Error("AI の判定結果のフォーマットが想定外です");
  }

  const base = {
    confidence: Math.max(0, Math.min(100, Math.round(raw.confidence))),
    imageType: normalizeImageType(raw.imageType),
    reason: raw.reason,
  };

  if (!isStrict) {
    return {
      isLikelyBankTransfer: raw.isLikelyBankTransfer,
      ...base,
    };
  }

  if (
    typeof raw.senderNameConfirmed !== "boolean" ||
    typeof raw.identifierConfirmed !== "boolean" ||
    typeof raw.amountConfirmed !== "boolean"
  ) {
    throw new Error("AI の判定結果のフォーマットが想定外です（strict チェック欠落）");
  }

  const strictChecks: BankTransferStrictChecks = {
    senderNameConfirmed: raw.senderNameConfirmed,
    identifierConfirmed: raw.identifierConfirmed,
    amountConfirmed: raw.amountConfirmed,
    detectedSenderName:
      typeof raw.detectedSenderName === "string" && raw.detectedSenderName.trim() !== ""
        ? raw.detectedSenderName.trim()
        : null,
  };

  // ストリクトモードの通過条件: 明細らしい かつ 必須 3 点すべて合格。
  // AI が isLikelyBankTransfer=true のまま個別チェックを落とした場合もコード側で確実に弾く。
  const passedAll =
    raw.isLikelyBankTransfer &&
    strictChecks.senderNameConfirmed &&
    strictChecks.identifierConfirmed &&
    strictChecks.amountConfirmed;

  return {
    isLikelyBankTransfer: passedAll,
    ...base,
    strictChecks,
  };
}

function normalizeImageType(value: string): BankTransferReceiptImageType {
  if (value === "photo" || value === "screenshot") {
    return value;
  }
  return "other";
}
