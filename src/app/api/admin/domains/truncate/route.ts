// src/app/api/admin/domains/truncate/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { verifyCurrentUserPassword } from "@/features/core/auth/services/server/verifyCurrentUserPassword";
import { getServiceOrThrow, getInvalidDomainKeys } from "@/lib/domain/server";

const TruncatePayloadSchema = z.object({
  domains: z.array(z.string()).min(1, "削除するドメインを選択してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

type TruncateResult = {
  domain: string;
  success: boolean;
  truncatedTables?: string[];
  error?: string;
};

/**
 * 指定されたドメインの全データを削除する（TRUNCATE CASCADE）
 * POST /api/admin/domains/truncate
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/admin/domains/truncate",
    operationType: "write",
    skipForDemo: true, // デモユーザーは実行不可
  },
  async (req, { session }) => {
    // admin権限チェック
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json(
        { message: "この操作を行う権限がありません。" },
        { status: 403 }
      );
    }

    // リクエストボディをパース
    const json = await req.json();
    const parsed = TruncatePayloadSchema.safeParse(json);

    if (!parsed.success) {
      const errorMessage = parsed.error.errors[0]?.message ?? "入力値が不正です。";
      return NextResponse.json({ message: errorMessage }, { status: 400 });
    }

    const { domains, password } = parsed.data;

    // パスワード検証
    const isPasswordValid = await verifyCurrentUserPassword(
      session.userId,
      password
    );

    if (!isPasswordValid) {
      return NextResponse.json(
        { message: "パスワードが正しくありません。" },
        { status: 401 }
      );
    }

    // ドメインキーの検証
    const invalidKeys = getInvalidDomainKeys(domains);
    if (invalidKeys.length > 0) {
      return NextResponse.json(
        { message: `無効なドメイン: ${invalidKeys.join(", ")}` },
        { status: 400 }
      );
    }

    // 各ドメインをtruncate
    const results: TruncateResult[] = [];

    for (const domainKey of domains) {
      try {
        const service = getServiceOrThrow<{
          truncateAll: () => Promise<string[]>;
        }>(domainKey);

        const truncatedTables = await service.truncateAll();

        results.push({
          domain: domainKey,
          success: true,
          truncatedTables,
        });
      } catch (error) {
        results.push({
          domain: domainKey,
          success: false,
          error: error instanceof Error ? error.message : "削除に失敗しました",
        });
      }
    }

    // 結果を集計
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `${successCount}件のドメインを削除しました。${failureCount > 0 ? `（${failureCount}件失敗）` : ""}`,
      results,
    });
  }
);
