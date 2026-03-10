// src/registry/profileTableRegistry.ts
// プロフィールテーブル定義の re-export + テーブルマップ（自動生成）
//
// このファイルは role:generate スクリプトによって自動生成されました

import type { PgTable } from "drizzle-orm/pg-core";

export * from "@/features/core/userProfile/generated/contributor/drizzle";
export * from "@/features/core/userProfile/generated/contributor";

import { ContributorProfileTable } from "@/features/core/userProfile/generated/contributor/drizzle";

/**
 * ロール → プロフィールテーブルのマッピング
 * searchWithProfile 等でプロフィールテーブルを動的に参照するために使用
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PROFILE_TABLE_MAP: Record<string, PgTable & Record<string, any>> = {
  contributor: ContributorProfileTable,
};
