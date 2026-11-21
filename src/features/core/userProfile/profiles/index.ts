// src/features/core/userProfile/profiles/index.ts
// プロフィール設定の型定義
//
// 各 profile.json は使用箇所で直接インポートすること
// 例: import userProfile from "@/features/core/userProfile/profiles/user.profile.json";

import type { AuditConfig } from "@/lib/crud/server";
import type { DomainConfigRelation } from "@/lib/domain";
import type { ProfileFieldConfig } from "../types";

/**
 * プロフィールリレーション設定 = domain.json の関連(DomainConfigRelation)。
 * プロフィールが持てる関連は belongsTo と belongsToMany だけ
 */
export type ProfileRelationConfig = Omit<DomainConfigRelation, "relationType"> & {
  relationType: "belongsTo" | "belongsToMany";
};

/**
 * プロフィール設定の型
 */
export type ProfileConfig = {
  roleId: string;
  fields: ProfileFieldConfig[];
  tags?: Record<string, string[]>;
  /** keyword検索対象のカラム名（camelCase） */
  searchFields?: string[];
  /** リレーション設定（domain.json と同じフォーマット） */
  relations?: ProfileRelationConfig[];
  /** 監査ログの設定（createCrudService の audit のうち JSON で書ける部分。recorder は pnpm generate role が渡す） */
  audit?: Partial<Omit<AuditConfig, "recorder">>;
};
