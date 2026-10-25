// src/lib/domain/config/apiAccess.ts
// 汎用ドメイン API (/api/[domain]/**) と管理データ操作のアクセスルール解決
//
// serviceRegistry のエントリが持つ access（DomainApiAccessConfig）から、操作に対するアクセスルールを
// 解決する純関数。registry を直接 import しないことで lib/domain を client-safe に保つ
// （access は呼び出し側＝server の routeFactory / 管理ルートが渡す）。
// ルールの評価（セッション照合）は呼び出し側（routeFactory の enforceAccessRule）が行う。

import { DOMAIN_API_ACCESS_CONFIG } from "@/config/app/domain-api-access.config";
import {
  DOMAIN_CRUD_OPERATIONS,
  DOMAIN_DATA_OPERATIONS,
  type DomainApiAccessConfig,
  type DomainApiAccessRule,
  type DomainApiOperation,
  type DomainDataOperation,
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

export function isDomainDataOperation(operation: DomainApiOperation): operation is DomainDataOperation {
  return (DOMAIN_DATA_OPERATIONS as readonly string[]).includes(operation);
}

/**
 * ドメインの access 設定 + 操作に対するアクセスルールを解決する。
 *
 * 設定ソースは serviceRegistry のエントリ（DomainRegistryEntry.access）。
 *
 * - CRUD 操作: `operations[operation]` → `read` / `write`（operationType に対応） → defaultRule
 *   （fail-closed: admin カテゴリのみ）
 * - 管理データ操作（truncateAll / export / import）: `operations[operation]` だけを見る。
 *   未指定・不正なら "none"（read / write / defaultRule には倒れない。登録しただけで
 *   全件削除やデータ移行の対象にならないようにするため）
 *
 * @param access serviceRegistry エントリの access（registry が唯一の実行時ソース）
 * @param operation 操作名（list, create, hardDelete, truncateAll 等）
 * @param operationType 操作の分類（read | write）。管理データ操作では見ない
 */
export function resolveAccessRule(
  access: DomainApiAccessConfig,
  operation: DomainApiOperation,
  operationType: "read" | "write",
): DomainApiAccessRule {
  const opRule = normalizeRule(access.operations?.[operation]);
  if (opRule) return opRule;

  if (isDomainDataOperation(operation)) return "none";

  const categoryRule = normalizeRule(access[operationType]);
  if (categoryRule) return categoryRule;

  return DOMAIN_API_ACCESS_CONFIG.defaultRule;
}

const READ_OPERATIONS: ReadonlySet<string> = new Set(["list", "get", "search", "count"]);

/**
 * 汎用 CRUD API（/api/<domain>/**）が全操作とも "none"（404）か。
 * 登録表には載せるが汎用 API には出さないドメイン（INTERNAL_ONLY）の判定に使う
 * （feature gate の検査が「閉じているべきルート」から外すため）。
 */
export function isGenericApiClosed(access: DomainApiAccessConfig): boolean {
  return DOMAIN_CRUD_OPERATIONS.every(
    (operation) =>
      resolveAccessRule(access, operation, READ_OPERATIONS.has(operation) ? "read" : "write") === "none",
  );
}
