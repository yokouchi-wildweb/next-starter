// src/app/api/data-migration/export/route.ts

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/features/core/auth/services/server/requireRole";
import { createApiRoute } from "@/wiring/apiRoute";
import { exportData } from "@/lib/dataMigration/export";
import { MEDIA_SKIPPED_EXAMPLES_HEADER, MEDIA_SKIPPED_HEADER } from "@/lib/dataMigration/media";
import { getService } from "@/wiring/domains";
import { createDataMigrationMediaResolver } from "../_shared/mediaResolver";
import { denyUnlessDomainDataOperationAllowed } from "../_shared/domainAccess";

type ExportRequestBody = {
  domain: string;
  selectedFields: string[];
  includeImages: boolean;
  searchParams?: string;
  imageFields?: string[];
  includeRelations?: boolean;
  selectedHasManyDomains?: string[];
};

export const POST = createApiRoute(
  {
    operation: "data-migration/export",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req: NextRequest) => {
    // 非公開ファイルの read 判定に使う実行者（DB と同期した管理者）
    const admin = await requireAdmin();

    const body = (await req.json()) as ExportRequestBody;

    const { domain, selectedFields, includeImages, searchParams, imageFields, includeRelations, selectedHasManyDomains } = body;

    // バリデーション
    if (!domain || typeof domain !== "string") {
      return NextResponse.json(
        { error: "domain is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    if (!Array.isArray(selectedFields) || selectedFields.length === 0) {
      return NextResponse.json(
        { error: "selectedFields is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // domainEntry.ts の access（export）をドメインごとに評価する（ルートの admin 門に加えて AND）。
    // 関連を含める export は、選んだ hasMany の子ドメインも書き出すので子も評価する（1 つでも拒否なら全体を拒否）
    const denied = await denyUnlessDomainDataOperationAllowed(
      [domain, ...(includeRelations && Array.isArray(selectedHasManyDomains) ? selectedHasManyDomains : [])],
      "export",
    );
    if (denied) return denied;

    // エクスポート実行
    const result = await exportData({
      domain,
      selectedFields,
      includeImages: includeImages ?? true,
      searchParams,
      imageFields: imageFields ?? [],
      media: createDataMigrationMediaResolver(admin),
      services: getService,
      includeRelations: includeRelations ?? false,
      selectedHasManyDomains: selectedHasManyDomains ?? [],
    });

    if (!result.success) {
      const status = result.code === "TOO_MANY_RECORDS" ? 400 : 500;
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          details: result.details,
        },
        { status }
      );
    }

    // ZIP ファイルを返す
    return new NextResponse(new Uint8Array(result.zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "X-Record-Count": String(result.recordCount),
        // ZIP に入らなかったメディア値（件数と例。詳細は manifest.json の mediaSkipped）
        [MEDIA_SKIPPED_HEADER]: String(result.mediaSkipped.count),
        [MEDIA_SKIPPED_EXAMPLES_HEADER]: encodeURIComponent(JSON.stringify(result.mediaSkipped.examples)),
      },
    });
  }
);
