// src/app/api/demo/bank-transfer-vision/route.ts
//
// AI 振込明細判定のサンドボックス用エンドポイント。
// formData に expectedIdentifier と expectedAmount の両方が含まれる場合は
// ストリクトモード（振込人名・識別数字・金額の 3 点確認）で判定する。
// どちらか一方のみの場合は 400 を返す（期待値が揃わないと照合できないため）。

import { NextResponse } from "next/server";

import {
  checkBankTransferReceipt,
  type BankTransferStrictExpectation,
  type SupportedImageMediaType,
} from "@/lib/aiVision";
import { createApiRoute } from "@/lib/routeFactory";

/** Anthropic Vision が受け付ける MIME タイプ */
const SUPPORTED_MEDIA_TYPES: readonly SupportedImageMediaType[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

/** 1画像あたりの最大サイズ（Anthropic 推奨上限）。 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

export const POST = createApiRoute(
  {
    operation: "POST /api/demo/bank-transfer-vision",
    operationType: "write",
    // サンドボックスで動作検証するため demo ユーザーでも実行を許可
    skipForDemo: false,
  },
  async (req, { session }) => {
    if (!session) {
      return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "file フィールドに画像を添付してください" },
        { status: 400 },
      );
    }

    if (!isSupportedMediaType(file.type)) {
      return NextResponse.json(
        {
          message: `対応していない画像形式です（${file.type || "unknown"}）。jpeg/png/gif/webp のいずれかをご利用ください`,
        },
        { status: 415 },
      );
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { message: "画像サイズが大きすぎます（最大5MB）" },
        { status: 413 },
      );
    }

    // ストリクトモードの期待値（任意）。両方揃ったときのみ strict 判定。
    const rawIdentifier = formData.get("expectedIdentifier");
    const rawAmount = formData.get("expectedAmount");
    const hasIdentifier = typeof rawIdentifier === "string" && rawIdentifier.trim() !== "";
    const hasAmount = typeof rawAmount === "string" && rawAmount.trim() !== "";

    if (hasIdentifier !== hasAmount) {
      return NextResponse.json(
        { message: "ストリクトモードには識別数字と振込金額の両方を指定してください" },
        { status: 400 },
      );
    }

    let strict: BankTransferStrictExpectation | undefined;
    if (hasIdentifier && hasAmount) {
      const expectedAmount = Number(rawAmount);
      if (!Number.isInteger(expectedAmount) || expectedAmount <= 0) {
        return NextResponse.json(
          { message: "振込金額は正の整数（円）で指定してください" },
          { status: 400 },
        );
      }
      strict = {
        expectedIdentifier: rawIdentifier.trim(),
        expectedAmount,
      };
    }

    const arrayBuffer = await file.arrayBuffer();
    const imageBase64 = Buffer.from(arrayBuffer).toString("base64");

    const result = await checkBankTransferReceipt({
      imageBase64,
      mediaType: file.type,
      strict,
    });

    return NextResponse.json(result);
  },
);

function isSupportedMediaType(value: string): value is SupportedImageMediaType {
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(value);
}
