// src/app/api/data-migration/import-chunk/route.ts

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/features/core/auth/services/server/requireRole";
import { createApiRoute } from "@/wiring/apiRoute";
import { importChunk } from "@/lib/dataMigration/import/importChunk";
import { getService } from "@/wiring/domains";
import { createDataMigrationMediaResolver } from "../_shared/mediaResolver";
import { denyUnlessDomainDataOperationAllowed } from "../_shared/domainAccess";

export const POST = createApiRoute(
  {
    operation: "data-migration/import-chunk",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req: NextRequest) => {
    // ファイル台帳の操作の実行者（DB と同期した管理者）
    const admin = await requireAdmin();

    // FormData からチャンクデータを取得
    const formData = await req.formData();

    const domain = formData.get("domain") as string | null;
    const chunkName = formData.get("chunkName") as string | null;
    const csvContent = formData.get("csvContent") as string | null;
    // imageFields（旧クライアントが送る）は読まない。メディア列はサービスの storageFields で決める
    const uploadedRefsRaw = formData.get("uploadedRefs") as string | null;
    const updateImagesRaw = formData.get("updateImages") as string | null;
    const fieldsRaw = formData.get("fields") as string | null;
    const domainType = formData.get("domainType") as "main" | "related" | "junction" | null;

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

    // domainEntry.ts の access（import）を評価する（ルートの admin 門に加えて AND）。中間表（junction）はサービスを持たないので対象外
    if (domainType !== "junction") {
      const denied = await denyUnlessDomainDataOperationAllowed([domain], "import");
      if (denied) return denied;
    }

    // オプションをパース
    const uploadedRefs: unknown = uploadedRefsRaw ? JSON.parse(uploadedRefsRaw) : [];
    if (!Array.isArray(uploadedRefs) || uploadedRefs.some((ref) => typeof ref !== "string")) {
      return NextResponse.json(
        { error: "uploadedRefs must be a string array", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    const updateImages = updateImagesRaw !== "false";
    const fields = fieldsRaw ? JSON.parse(fieldsRaw) : [];

    // アセットファイルを取得（画像など）
    const assets = new Map<string, Uint8Array>();
    for (const [key, value] of formData.entries()) {
      // File は Blob を継承しているので Blob チェックで両方対応
      if (key.startsWith("asset:") && value instanceof Blob) {
        const assetPath = key.replace("asset:", "");
        const arrayBuffer = await value.arrayBuffer();
        assets.set(assetPath, new Uint8Array(arrayBuffer));
      }
    }

    console.log(`[Import] Assets received: ${assets.size} files, uploadedRefs: ${uploadedRefs.length}`);

    // チャンクをインポート
    const result = await importChunk({
      domain,
      chunkName,
      csvContent,
      assets,
      uploadedRefs: uploadedRefs as string[],
      updateImages,
      fields,
      domainType: domainType || undefined,
      media: createDataMigrationMediaResolver(admin),
      services: getService,
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
