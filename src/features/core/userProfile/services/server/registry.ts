// src/features/core/userProfile/services/server/registry.ts
// ロールとプロフィールベースのマッピング
//
// 新しいロール用プロフィールを追加する場合:
// 1. bases/ に xxxProfileBase.ts を作成
// 2. このファイルの PROFILE_BASE_REGISTRY に追加

import { contributorProfileBase } from "./bases/contributorProfileBase";

/**
 * プロフィールベースの共通インターフェース
 * userId ベースの操作を提供
 */
export type ProfileBase = {
  // createCrudService から継承（id ベース）
  get: (id: string) => Promise<any>;
  create: (data: any) => Promise<any>;
  update: (id: string, data: any) => Promise<any>;
  remove: (id: string) => Promise<void>;
  upsert: (data: any) => Promise<any>;
  // userId ベースのカスタムメソッド
  getByUserId: (userId: string) => Promise<any>;
  existsByUserId: (userId: string) => Promise<boolean>;
  updateByUserId: (userId: string, data: any) => Promise<any>;
  removeByUserId: (userId: string) => Promise<boolean>;
};

/**
 * ロール → プロフィールベースのマッピング
 * 新しいロールを追加する場合はここに登録
 */
export const PROFILE_BASE_REGISTRY: Record<string, ProfileBase> = {
  contributor: contributorProfileBase,
  // 例: organizer: organizerProfileBase,
};

/**
 * プロフィールベースを持つロールの一覧
 */
export const PROFILE_ROLES = Object.keys(PROFILE_BASE_REGISTRY);

/**
 * ロールがプロフィールベースを持つか確認
 */
export function hasProfileBase(role: string): boolean {
  return role in PROFILE_BASE_REGISTRY;
}

/**
 * ロールに対応するプロフィールベースを取得
 */
export function getProfileBase(role: string): ProfileBase | null {
  return PROFILE_BASE_REGISTRY[role] ?? null;
}
