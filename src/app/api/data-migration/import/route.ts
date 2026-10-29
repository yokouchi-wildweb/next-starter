// src/app/api/data-migration/import/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createApiRoute } from "@/wiring/apiRoute";
import { importData } from "@/lib/dataMigration/import";
import { getService } from "@/wiring/domains";
import { createDataMigrationMediaResolver } from "../_shared/mediaResolver";
import { denyUnlessDomainDataOperationAllowed } from "../_shared/domainAccess";

export const POST = createApiRoute(
  {
    operation: "data-migration/import",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req: NextRequest, { user: admin }) => {
    // ファイル台帳の操作の実行者 = Factory が解いた管理者（DB 同期）

    // FormData から ZIP ファイルを取得
    const formData = await req.formData();

    const file = formData.get("file") as File | null;
    const domain = formData.get("domain") as string | null;
    // imageFields（旧クライアントが送る）は読まない。メディア列はサービスの storageFields で決める
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

    // domainEntry.ts の access（import）を評価する（ルートの admin 門に加えて AND）
    const denied = await denyUnlessDomainDataOperationAllowed([domain], "import", admin);
    if (denied) return denied;

    // ZIP ファイルを Buffer に変換
    const arrayBuffer = await file.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);

    // オプションをパース
    const updateImages = updateImagesRaw !== "false";
    const fields = fieldsRaw ? JSON.parse(fieldsRaw) : [];

    // インポート実行
    const result = await importData({
      domain,
      zipBuffer,
      updateImages,
      fields,
      media: createDataMigrationMediaResolver(admin),
      services: getService,
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
