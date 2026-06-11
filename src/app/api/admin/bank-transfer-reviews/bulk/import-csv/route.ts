// src/app/api/admin/bank-transfer-reviews/bulk/import-csv/route.ts
//
// 管理者向け: 銀行振込明細 CSV を一括取り込みして、レビューを自動承認 (confirmed) または
// 要確認 (needs_check) に振り分ける API。
//
// リクエストボディ:
//   - csvText: アップロードまたは貼り付けされた CSV テキスト
//   - dryRun: true なら検証のみ（プレビュー用）/ false なら実際に判定実行
//
// 共通基底 CsvImportResponseBase + ドメイン固有集計 (confirmedCount / needsCheckCount /
// skipCount / errorCount) を返す。詳細は wrappers/bulkImportFromCsv.ts を参照。

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { bankTransferReviewService } from "@/features/bankTransferReview/services/server/bankTransferReviewService";

const BodySchema = z.object({
  csvText: z.string().min(1, { message: "CSVテキストを指定してください。" }),
  dryRun: z.boolean(),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/bank-transfer-reviews/bulk/import-csv",
    operationType: "write",
    skipForDemo: false,
  },
  async (req, { session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json(
        { message: "この操作を行う権限がありません。" },
        { status: 403 },
      );
    }

    let body: z.infer<typeof BodySchema>;
    try {
      const json = await req.json();
      const parsed = BodySchema.safeParse(json);
      if (!parsed.success) {
        const message = parsed.error.errors[0]?.message ?? "入力値が不正です。";
        return NextResponse.json({ message }, { status: 400 });
      }
      body = parsed.data;
    } catch {
      return NextResponse.json(
        { message: "リクエストボディの解析に失敗しました。" },
        { status: 400 },
      );
    }

    const result = await bankTransferReviewService.bulkImportFromCsv({
      csvText: body.csvText,
      dryRun: body.dryRun,
      triggeredBy: session.userId,
    });

    return result;
  },
);
