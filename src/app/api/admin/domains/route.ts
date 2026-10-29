// src/app/api/admin/domains/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { requireAdmin } from "@/features/core/auth/services/server/requireRole";
import { evaluateApiAccessRule } from "@/features/core/auth/services/server/apiAccess";
import { resolveAccessRule } from "@/lib/domain";
import { getDomainAccess, getDomainList, withRecordCounts } from "@/wiring/domains";

/**
 * 全件削除できるドメインの一覧を取得する（レコード数付き）
 * GET /api/admin/domains
 *
 * 登録表のうち truncateAll 対応で、かつ domainEntry.ts の access（truncateAll）が今の管理者に許可されているものだけを返す
 * （admin の門に加えて AND。INTERNAL_ONLY のドメインは出ない）。
 */
export const GET = createApiRoute(
  {
    operation: "GET /api/admin/domains",
    operationType: "read",
    access: "custom",
  },
  async () => {
    // admin権限チェック（DB と同期した値で判定）
    const admin = await requireAdmin();

    const candidates = await getDomainList();
    const allowed = candidates.filter((domain) => {
      const access = getDomainAccess(domain.key);
      if (!access) return false;
      return evaluateApiAccessRule(resolveAccessRule(access, "truncateAll", "write"), admin) === "granted";
    });

    const domains = await withRecordCounts(allowed);
    return NextResponse.json({ domains });
  }
);
