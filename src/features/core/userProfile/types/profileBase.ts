// src/features/core/userProfile/types/profileBase.ts
// プロフィールベースサービスの型定義

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
  // userId ベースのカスタムメソッド
  getByUserId: (userId: string) => Promise<Record<string, unknown> | null>;
  existsByUserId: (userId: string) => Promise<boolean>;
  updateByUserId: (userId: string, data: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  removeByUserId: (userId: string) => Promise<boolean>;
};
