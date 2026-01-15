// src/app/api/data-migration/export/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createApiRoute } from "@/lib/routeFactory";
import { exportData } from "@/lib/dataMigration/export";

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
  },
  async (req: NextRequest) => {
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

    // エクスポート実行
    const result = await exportData({
      domain,
      selectedFields,
      includeImages: includeImages ?? true,
      searchParams,
      imageFields: imageFields ?? [],
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
      },
    });
  }
);
