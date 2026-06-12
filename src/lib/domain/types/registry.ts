// src/lib/domain/types/registry.ts
// serviceRegistry の登録エントリ型

import type { DomainApiAccessConfig } from "./apiAccess";

/**
 * ドメイン登録エントリ。
 * service（CRUD サービス）と access（汎用 API のアクセスポリシー）を必ず対で登録する。
 *
 * access を型必須にすることで「サービスを登録したが認可ポリシーを宣言し忘れる」ことを
 * 構造的に防ぐ（fail-closed by construction）。汎用ルート（createDomainRoute）は
 * このエントリの access を唯一の実行時ソースとして認可する。
 * access を空 {} にした場合も defaultRule（admin 限定）にフォールバックし安全側に倒れる。
 *
 * 詳細: docs/how-to/APIルート認可実装ガイド.md
 */
export type DomainRegistryEntry = {
  // サービスの型はドメインごとに異なるため any で受ける（既存 Record<string, any> 挙動を踏襲）
  service: any;
  access: DomainApiAccessConfig;
};
