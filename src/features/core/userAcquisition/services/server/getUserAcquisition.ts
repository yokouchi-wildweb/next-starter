// src/features/core/userAcquisition/services/server/getUserAcquisition.ts

import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import {
  UserAcquisitionTable,
  UserAcquisitionTouchTable,
} from "@/features/core/userAcquisition/entities/drizzle";
import type {
  UserAcquisition,
  UserAcquisitionTouch,
} from "@/features/core/userAcquisition/entities/model";

/**
 * ユーザーの流入経路サマリーを取得する（無ければ null）。
 * 行が無い = 計測可能な流入シグナル無し（オーガニック直訪のみ）を意味する。
 */
export async function getUserAcquisition(userId: string): Promise<UserAcquisition | null> {
  const rows = await db
    .select()
    .from(UserAcquisitionTable)
    .where(eq(UserAcquisitionTable.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * ユーザーの流入タッチ明細を時系列昇順で取得する。
 * タッチ数は cookie 由来で最大でも ACQUISITION_CONFIG.maxTouches 件のため全件取得で問題ない。
 */
export async function getUserAcquisitionTouches(
  userId: string,
): Promise<UserAcquisitionTouch[]> {
  return db
    .select()
    .from(UserAcquisitionTouchTable)
    .where(eq(UserAcquisitionTouchTable.userId, userId))
    .orderBy(asc(UserAcquisitionTouchTable.touchIndex));
}
