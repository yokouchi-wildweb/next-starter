// src/app/api/demo/bank-transfer-vision/route.ts

import { NextResponse } from "next/server";

import {
  checkBankTransferReceipt,
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

    const arrayBuffer = await file.arrayBuffer();
    const imageBase64 = Buffer.from(arrayBuffer).toString("base64");

    const result = await checkBankTransferReceipt({
      imageBase64,
      mediaType: file.type,
    });

    return NextResponse.json(result);
  },
);

function isSupportedMediaType(value: string): value is SupportedImageMediaType {
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(value);
}
