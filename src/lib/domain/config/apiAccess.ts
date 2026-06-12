// src/lib/domain/config/apiAccess.ts
// 汎用ドメイン API (/api/[domain]/**) のアクセスルール解決
//
// serviceRegistry のエントリが持つ apiAccess 設定（DomainApiAccessConfig）から、
// 操作に対するアクセスルールを解決する純関数。registry を直接 import しないことで
// lib/domain を client-safe に保つ（access は呼び出し側＝server の routeFactory が渡す）。
// ルールの評価（セッション照合）は呼び出し側（routeFactory）が行う。

import { DOMAIN_API_ACCESS_CONFIG } from "@/config/app/domain-api-access.config";
import type {
  DomainApiAccessConfig,
  DomainApiAccessRule,
  DomainApiOperation,
} from "../types";

const VALID_STRING_RULES = ["public", "authenticated", "none"] as const;

/**
 * 設定値をアクセスルールとして検証する。
 * 不正な値は undefined を返し、呼び出し側でフォールバックさせる。
 */
function normalizeRule(raw: unknown): DomainApiAccessRule | undefined {
  if (typeof raw === "string") {
    return (VALID_STRING_RULES as readonly string[]).includes(raw)
      ? (raw as DomainApiAccessRule)
      : undefined;
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const { roles, roleCategories } = raw as { roles?: unknown; roleCategories?: unknown };
    const validRoles = roles === undefined || (Array.isArray(roles) && roles.every((r) => typeof r === "string"));
    const validCategories =
      roleCategories === undefined ||
      (Array.isArray(roleCategories) && roleCategories.every((c) => typeof c === "string"));
    if (validRoles && validCategories && (roles !== undefined || roleCategories !== undefined)) {
      return raw as DomainApiAccessRule;
    }
  }
  return undefined;
}

/**
 * ドメインの apiAccess 設定 + 操作に対するアクセスルールを解決する。
 *
 * 設定ソースは serviceRegistry のエントリ（DomainRegistryEntry.access）。
 * access は型必須だが内部の read/write/operations は任意のため、当該操作に対する
 * ルールが宣言されていない場合は defaultRule（fail-closed: admin カテゴリのみ）へ倒す。
 *
 * 解決優先順位: operations[operation] → read/write（operationType に対応） → defaultRule
 *
 * @param access serviceRegistry エントリの access（registry が唯一の実行時ソース）
 * @param operation 操作名（list, create, hardDelete 等）
 * @param operationType 操作の分類（read | write）
 */
export function resolveAccessRule(
  access: DomainApiAccessConfig,
  operation: DomainApiOperation,
  operationType: "read" | "write",
): DomainApiAccessRule {
  const opRule = normalizeRule(access.operations?.[operation]);
  if (opRule) return opRule;

  const categoryRule = normalizeRule(access[operationType]);
  if (categoryRule) return categoryRule;

  return DOMAIN_API_ACCESS_CONFIG.defaultRule;
}
