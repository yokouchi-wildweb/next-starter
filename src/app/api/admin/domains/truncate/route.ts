// src/app/api/admin/domains/truncate/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute, enforceAccessRule } from "@/wiring/apiRoute";
import { requireAdmin } from "@/features/core/auth/services/server/requireRole";
import { verifyCurrentUserPassword } from "@/features/core/auth/services/server/verifyCurrentUserPassword";
import { resolveAccessRule } from "@/lib/domain";
import { getDomainAccess, getInvalidDomainKeys, getServiceOrThrow } from "@/wiring/domains";

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
 *
 * 門: admin カテゴリ（DB 同期）+ 本人パスワード + domainEntry.ts の access（truncateAll）をドメインごとに評価（AND）。
 * 1 つでも拒否されたドメインがあれば要求全体を拒否し、何も消さない（取り消せない操作を部分実行しない）。
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/admin/domains/truncate",
    operationType: "write",
    access: "custom",
    skipForDemo: true, // デモユーザーは実行不可
  },
  async (req) => {
    // admin権限チェック（DB と同期した値で判定）
    const admin = await requireAdmin();

    // リクエストボディをパース
    const json = await req.json();
    const parsed = TruncatePayloadSchema.safeParse(json);

    if (!parsed.success) {
      const errorMessage = parsed.error.errors[0]?.message ?? "入力値が不正です。";
      return NextResponse.json({ message: errorMessage }, { status: 400 });
    }

    const { domains, password } = parsed.data;

    // パスワード検証
    const isPasswordValid = await verifyCurrentUserPassword(admin.userId, password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { message: "パスワードが正しくありません。" },
        { status: 401 }
      );
    }

    // ドメインキーの検証（登録済みかつ truncateAll 対応）
    const invalidKeys = await getInvalidDomainKeys(domains);
    if (invalidKeys.length > 0) {
      return NextResponse.json(
        { message: `無効なドメイン: ${invalidKeys.join(", ")}` },
        { status: 400 }
      );
    }

    // access（truncateAll）の評価。未指定のドメインは "none" なので拒否される
    for (const domainKey of domains) {
      const access = getDomainAccess(domainKey);
      const denied = access
        ? await enforceAccessRule(resolveAccessRule(access, "truncateAll", "write"))
        : new NextResponse("Not Found", { status: 404 });
      if (denied) {
        return NextResponse.json(
          { message: `全件削除が許可されていないドメインが含まれています: ${domainKey}` },
          { status: 403 }
        );
      }
    }

    // 各ドメインをtruncate
    const results: TruncateResult[] = [];

    for (const domainKey of domains) {
      try {
        const service = await getServiceOrThrow<{
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
