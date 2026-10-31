// src/app/api/admin/domains/route.ts

import { NextResponse } from "next/server";

import { createApiRoute, enforceAccessRule } from "@/wiring/apiRoute";
import { resolveAccessRule } from "@/lib/domain";
import { getDomainAccess, getDomainList, withRecordCounts } from "@/wiring/domainRegistry";

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
    access: { roleCategories: ["admin"] },
  },
  async (_req, { user: admin }) => {
    const candidates = await getDomainList();
    // Factory が解いた管理者（DB 同期）で、ドメインごとの access（truncateAll）を評価する
    const granted = await Promise.all(
      candidates.map(async (domain) => {
        const access = getDomainAccess(domain.key);
        if (!access) return false;
        return (await enforceAccessRule(resolveAccessRule(access, "truncateAll", "write"), admin)) === null;
      }),
    );
    const allowed = candidates.filter((_, index) => granted[index]);

    const domains = await withRecordCounts(allowed);
    return NextResponse.json({ domains });
  }
);
