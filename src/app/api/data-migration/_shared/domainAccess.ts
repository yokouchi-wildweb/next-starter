// src/app/api/data-migration/_shared/domainAccess.ts
// データ移行のルートが、domainEntry.ts の access（export / import）をドメインごとに評価するための共通処理。
// ルート自体の門（access roleCategories admin）に加えて AND で掛ける。主体は引き直さず、Factory が解いた ctx.user を受け取る。
// 1 つでも拒否されたドメインがあれば要求全体を拒否する（部分実行しない）。

import { NextResponse } from "next/server";

import type { SessionUser } from "@/features/core/auth/entities/session";
import type { DomainDataOperation } from "@/lib/domain/types";
import { resolveAccessRule } from "@/lib/domain";
import { enforceAccessRule } from "@/wiring/apiRoute";
import { getDomainAccess } from "@/wiring/domainRegistry";
import { toCamelCase } from "@/utils/stringCase.mjs";

/**
 * 指定ドメイン（snake_case / camelCase どちらでも）の管理データ操作を access で評価する。
 * 未登録のドメインは 404、access が閉じていれば enforceAccessRule の応答（404 / 401 / 403）。許可なら null
 * user = ルートの Factory が解いた利用者（ctx.user）
 */
export async function denyUnlessDomainDataOperationAllowed(
  domains: readonly string[],
  operation: DomainDataOperation,
  user: SessionUser,
): Promise<NextResponse | null> {
  for (const domain of domains) {
    const access = getDomainAccess(toCamelCase(domain));
    if (!access) {
      return NextResponse.json({ error: `Invalid domain: ${domain}`, code: "INVALID_DOMAIN" }, { status: 404 });
    }
    const denied = await enforceAccessRule(resolveAccessRule(access, operation, "write"), user, {
      domain: toCamelCase(domain),
      operation,
    });
    if (denied) return denied;
  }
  return null;
}
