// src/app/api/data-migration/_shared/domainAccess.ts
// データ移行のルートが、domainEntry.ts の access（export / import）をドメインごとに評価するための共通処理。
// ルート自体の門（access roleCategories admin + requireAdmin）に加えて AND で掛ける。
// 1 つでも拒否されたドメインがあれば要求全体を拒否する（部分実行しない）。

import { NextResponse } from "next/server";

import type { DomainDataOperation } from "@/lib/domain/types";
import { resolveAccessRule } from "@/lib/domain";
import { enforceAccessRule } from "@/wiring/apiRoute";
import { getDomainAccess } from "@/wiring/domains";
import { toCamelCase } from "@/utils/stringCase.mjs";

/**
 * 指定ドメイン（snake_case / camelCase どちらでも）の管理データ操作を access で評価する。
 * 未登録のドメインは 404、access が閉じていれば enforceAccessRule の応答（404 / 401 / 403）。許可なら null
 */
export async function denyUnlessDomainDataOperationAllowed(
  domains: readonly string[],
  operation: DomainDataOperation,
): Promise<NextResponse | null> {
  for (const domain of domains) {
    const access = getDomainAccess(toCamelCase(domain));
    if (!access) {
      return NextResponse.json({ error: `Invalid domain: ${domain}`, code: "INVALID_DOMAIN" }, { status: 404 });
    }
    const denied = await enforceAccessRule(resolveAccessRule(access, operation, "write"));
    if (denied) return denied;
  }
  return null;
}
