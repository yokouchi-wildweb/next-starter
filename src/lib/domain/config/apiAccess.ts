// src/lib/domain/config/apiAccess.ts
// 汎用ドメイン API (/api/[domain]/**) のアクセスルール解決
//
// domain.json の apiAccess 宣言から、ドメイン + 操作に対するアクセスルールを解決する。
// 未宣言・不正値・domain.json を持たないドメインはグローバル既定値（fail-closed）に
// フォールバックする。ルールの評価（セッション照合）は呼び出し側（routeFactory）が行う。

import { DOMAIN_API_ACCESS_CONFIG } from "@/config/app/domain-api-access.config";
import type {
  DomainApiAccessConfig,
  DomainApiAccessRule,
  DomainApiOperation,
} from "../types";
import { getDomainConfig, hasDomainConfig } from "./getDomainConfig";

const VALID_STRING_RULES = ["public", "authenticated", "none"] as const;

/**
 * domain.json から読み込んだ生の値をアクセスルールとして検証する。
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

// 同一ドメインへの警告を 1 回に抑制するためのキャッシュ
const warnedDomains = new Set<string>();

function warnFallback(domain: string, reason: string): void {
  if (!DOMAIN_API_ACCESS_CONFIG.warnOnFallback) return;
  if (process.env.NODE_ENV === "production") return;
  if (warnedDomains.has(domain)) return;
  warnedDomains.add(domain);
  console.warn(
    `[domainApiAccess] ${reason} (domain: ${domain})。` +
      `既定ルール（fail-closed: ${JSON.stringify(DOMAIN_API_ACCESS_CONFIG.defaultRule)}）を適用します。` +
      `domain.json に apiAccess を明示宣言してください。スキーマ: src/features/README.md`,
  );
}

/**
 * ドメイン + 操作に対するアクセスルールを解決する。
 *
 * 優先順位: operations[operation] → read/write（operationType に対応） → グローバル既定値
 *
 * @param domain ドメイン名（snake_case / camelCase どちらも可）
 * @param operation 操作名（list, create, hardDelete 等）
 * @param operationType 操作の分類（read | write）
 */
export function resolveDomainApiAccessRule(
  domain: string,
  operation: DomainApiOperation,
  operationType: "read" | "write",
): DomainApiAccessRule {
  if (!hasDomainConfig(domain)) {
    warnFallback(domain, "domain.json が存在しないドメインへの汎用 API アクセス");
    return DOMAIN_API_ACCESS_CONFIG.defaultRule;
  }

  const config = getDomainConfig(domain);
  const access = (config as { apiAccess?: DomainApiAccessConfig }).apiAccess;

  if (!access) {
    warnFallback(domain, "apiAccess が未宣言");
    return DOMAIN_API_ACCESS_CONFIG.defaultRule;
  }

  const opRule = normalizeRule(access.operations?.[operation]);
  if (opRule) return opRule;

  const categoryRule = normalizeRule(access[operationType]);
  if (categoryRule) return categoryRule;

  return DOMAIN_API_ACCESS_CONFIG.defaultRule;
}
