// src/features/core/userProfile/utils/createProfileBase.ts
// プロフィールベースのファクトリ関数

import { eq } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { createCrudService } from "@/lib/crud/drizzle";
import type { ProfileBase } from "../types";

/**
 * プロフィールベースを生成するファクトリ関数
 *
 * @param table - Drizzle プロフィールテーブル（id, userId, createdAt, updatedAt を持つ）
 * @returns ProfileBase インターフェースを実装したオブジェクト
 */
export function createProfileBase(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
): ProfileBase {
  // 基本CRUD（createCrudService使用）
  const base = createCrudService(table, {
    idType: "uuid",
    useCreatedAt: true,
    useUpdatedAt: true,
    defaultUpsertConflictFields: ["userId"],
  });

  /**
   * userId でプロフィールを取得
   */
  async function getByUserId(userId: string): Promise<Record<string, unknown> | null> {
    const result = await db
      .select()
      .from(table)
      .where(eq(table.userId, userId));
    return (result[0] as Record<string, unknown>) ?? null;
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
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const now = new Date();
    const result = await db
      .update(table)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(table.userId, userId))
      .returning();

    return (result[0] as Record<string, unknown>) ?? null;
  }

  /**
   * userId でプロフィールを削除
   */
  async function removeByUserId(userId: string): Promise<boolean> {
    const result = await db
      .delete(table)
      .where(eq(table.userId, userId))
      .returning();

    return result.length > 0;
  }

  return {
    ...(base as unknown as Record<string, unknown>),
    getByUserId,
    existsByUserId,
    updateByUserId,
    removeByUserId,
  } as ProfileBase;
}
