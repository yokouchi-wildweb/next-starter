// src/app/api/data-migration/import-chunk/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createApiRoute } from "@/lib/routeFactory";
import { importChunk } from "@/lib/dataMigration/import/importChunk";

export const POST = createApiRoute(
  {
    operation: "data-migration/import-chunk",
    operationType: "write",
  },
  async (req: NextRequest) => {
    // FormData からチャンクデータを取得
    const formData = await req.formData();

    const domain = formData.get("domain") as string | null;
    const chunkName = formData.get("chunkName") as string | null;
    const csvContent = formData.get("csvContent") as string | null;
    const imageFieldsRaw = formData.get("imageFields") as string | null;
    const updateImagesRaw = formData.get("updateImages") as string | null;
    const fieldsRaw = formData.get("fields") as string | null;

    // バリデーション
    if (!domain || typeof domain !== "string") {
      return NextResponse.json(
        { error: "domain is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    if (!chunkName || typeof chunkName !== "string") {
      return NextResponse.json(
        { error: "chunkName is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    if (!csvContent || typeof csvContent !== "string") {
      return NextResponse.json(
        { error: "csvContent is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // オプションをパース
    const imageFields = imageFieldsRaw ? JSON.parse(imageFieldsRaw) : [];
    const updateImages = updateImagesRaw !== "false";
    const fields = fieldsRaw ? JSON.parse(fieldsRaw) : [];

    // アセットファイルを取得（画像など）
    const assets = new Map<string, Buffer>();
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("asset:") && value instanceof File) {
        const assetPath = key.replace("asset:", "");
        const arrayBuffer = await value.arrayBuffer();
        assets.set(assetPath, Buffer.from(arrayBuffer));
      }
    }

    // チャンクをインポート
    const result = await importChunk({
      domain,
      chunkName,
      csvContent,
      assets,
      imageFields,
      updateImages,
      fields,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          code: "IMPORT_ERROR",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      chunkName: result.chunkName,
      recordCount: result.recordCount,
    });
  }
);
