// src/app/api/data-migration/import/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createApiRoute } from "@/lib/routeFactory";
import { importData } from "@/lib/dataMigration/import";

export const POST = createApiRoute(
  {
    operation: "data-migration/import",
    operationType: "write",
  },
  async (req: NextRequest) => {
    // FormData から ZIP ファイルを取得
    const formData = await req.formData();

    const file = formData.get("file") as File | null;
    const domain = formData.get("domain") as string | null;
    const imageFieldsRaw = formData.get("imageFields") as string | null;
    const updateImagesRaw = formData.get("updateImages") as string | null;
    const fieldsRaw = formData.get("fields") as string | null;

    // バリデーション
    if (!file) {
      return NextResponse.json(
        { error: "file is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    if (!domain || typeof domain !== "string") {
      return NextResponse.json(
        { error: "domain is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // ZIP ファイルを Buffer に変換
    const arrayBuffer = await file.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);

    // オプションをパース
    const imageFields = imageFieldsRaw ? JSON.parse(imageFieldsRaw) : [];
    const updateImages = updateImagesRaw !== "false";
    const fields = fieldsRaw ? JSON.parse(fieldsRaw) : [];

    // インポート実行
    const result = await importData({
      domain,
      zipBuffer,
      imageFields,
      updateImages,
      fields,
    });

    if (!result.success) {
      const status =
        result.code === "TOO_MANY_RECORDS" || result.code === "DOMAIN_MISMATCH" ? 400 : 500;
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          details: result.details,
        },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      totalRecords: result.totalRecords,
      successfulChunks: result.successfulChunks,
      failedChunks: result.failedChunks,
      chunkResults: result.chunkResults,
    });
  }
);
