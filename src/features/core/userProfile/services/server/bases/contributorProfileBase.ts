// src/features/core/userProfile/services/server/bases/contributorProfileBase.ts
// 投稿者プロフィールテーブルの基本CRUD操作

import { eq } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { createCrudService } from "@/lib/crud/drizzle";
import {
  ContributorProfileTable,
  type ContributorProfile,
} from "../../../entities/drizzle";

/**
 * 基本CRUDサービス（createCrudService使用）
 */
const base = createCrudService(ContributorProfileTable, {
  idType: "uuid",
  useCreatedAt: true,
  useUpdatedAt: true,
  // userId での upsert に対応
  defaultUpsertConflictFields: ["userId"],
});

/**
 * userId でプロフィールを取得（カスタムメソッド）
 */
async function getByUserId(userId: string): Promise<ContributorProfile | null> {
  const result = await db
    .select()
    .from(ContributorProfileTable)
    .where(eq(ContributorProfileTable.userId, userId));
  return result[0] ?? null;
}

/**
 * userId でプロフィールが存在するか確認
 */
async function existsByUserId(userId: string): Promise<boolean> {
  const result = await getByUserId(userId);
  return result !== null;
}

/**
 * userId でプロフィールを更新
 */
async function updateByUserId(
  userId: string,
  data: Partial<Omit<ContributorProfile, "id" | "userId" | "createdAt" | "updatedAt">>,
): Promise<ContributorProfile | null> {
  const now = new Date();
  const result = await db
    .update(ContributorProfileTable)
    .set({
      ...data,
      updatedAt: now,
    })
    .where(eq(ContributorProfileTable.userId, userId))
    .returning();

  return result[0] ?? null;
}

/**
 * userId でプロフィールを削除
 */
async function removeByUserId(userId: string): Promise<boolean> {
  const result = await db
    .delete(ContributorProfileTable)
    .where(eq(ContributorProfileTable.userId, userId))
    .returning();

  return result.length > 0;
}

export const contributorProfileBase = {
  ...base,
  // userId ベースのカスタムメソッド
  getByUserId,
  existsByUserId,
  updateByUserId,
  removeByUserId,
};
