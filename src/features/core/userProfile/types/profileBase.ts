// src/features/core/userProfile/types/profileBase.ts
// プロフィールベースサービスの型定義

import type { SQL } from "drizzle-orm";
import type {
  SearchParams,
  PaginatedResult,
  WithOptions,
} from "@/lib/crud/types";
import type { ExtraWhereOption } from "@/lib/crud/drizzle/types";

/**
 * プロフィールベースの共通インターフェース
 * 各ロールのプロフィールテーブルに対するCRUD操作を提供
 */
export type ProfileBase = {
  // createCrudService から継承（id ベース）
  get: (id: string) => Promise<Record<string, unknown> | null>;
  create: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  update: (id: string, data: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  remove: (id: string) => Promise<void>;
  upsert: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  // createCrudService から継承（検索・一覧）
  search: (
    params?: SearchParams & WithOptions & ExtraWhereOption,
  ) => Promise<PaginatedResult<Record<string, unknown>>>;
  list: (options?: WithOptions) => Promise<Record<string, unknown>[]>;
  query: <T extends Record<string, unknown> = Record<string, unknown>>(
    baseQuery: unknown,
    options?: {
      page?: number;
      limit?: number;
      orderBy?: SQL[];
      where?: SQL;
    } & WithOptions,
    countQuery?: unknown,
  ) => Promise<PaginatedResult<T>>;
  // userId ベースのカスタムメソッド
  getByUserId: (userId: string) => Promise<Record<string, unknown> | null>;
  existsByUserId: (userId: string) => Promise<boolean>;
  updateByUserId: (userId: string, data: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  removeByUserId: (userId: string) => Promise<boolean>;
};
