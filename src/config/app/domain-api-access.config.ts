// src/config/app/domain-api-access.config.ts

import type { DomainApiAccessRule } from "@/lib/domain/types";

/**
 * 汎用ドメイン API (/api/[domain]/**) アクセス制御のグローバル設定
 *
 * 各ドメインのアクセスルールは domain.json の apiAccess で宣言する。
 * ここでは未宣言時のフォールバック（fail-closed）を定義する。
 * スキーマ: src/features/README.md「ApiAccess」
 */
export const DOMAIN_API_ACCESS_CONFIG = {
  /**
   * apiAccess 未宣言ドメイン / domain.json を持たないドメイン（wallet 等）の既定ルール
   * 安全側に倒すため admin カテゴリのみ許可
   */
  defaultRule: { roleCategories: ["admin"] } as DomainApiAccessRule,

  /**
   * 開発環境で apiAccess 未宣言ドメインへのアクセス時に警告ログを出すか
   */
  warnOnFallback: true,
} as const;
