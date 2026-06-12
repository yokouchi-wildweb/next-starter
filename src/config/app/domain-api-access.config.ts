// src/config/app/domain-api-access.config.ts

import type { DomainApiAccessConfig, DomainApiAccessRule } from "@/lib/domain/types";

/**
 * 汎用ドメイン API (/api/[domain]/**) アクセス制御のグローバル設定
 *
 * 各ドメインのアクセスポリシーは serviceRegistry の登録エントリ（access）で宣言する。
 * ここでは、access に当該操作のルールが宣言されていない場合のフォールバック（fail-closed）を定義する。
 * 詳細: docs/how-to/APIルート認可実装ガイド.md
 */
export const DOMAIN_API_ACCESS_CONFIG = {
  /**
   * access が当該操作をカバーしない場合の既定ルール
   * 安全側に倒すため admin カテゴリのみ許可
   */
  defaultRule: { roleCategories: ["admin"] } as DomainApiAccessRule,
} as const;

/**
 * serviceRegistry 登録で再利用するアクセスポリシーのプリセット。
 */

/** 読み書きとも管理者カテゴリのみ */
export const ADMIN_ONLY: DomainApiAccessConfig = {
  read: { roleCategories: ["admin"] },
  write: { roleCategories: ["admin"] },
};

/** 公開読み取り + 管理者書き込み（公開マスタ等） */
export const PUBLIC_READ: DomainApiAccessConfig = {
  read: "public",
  write: { roleCategories: ["admin"] },
};
