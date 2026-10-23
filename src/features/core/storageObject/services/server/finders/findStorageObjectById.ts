// src/features/core/storageObject/services/server/finders/findStorageObjectById.ts
//
// 台帳の 1 行を session_uri（hiddenColumns）込みで読む専用ファインダー。
// セッションの中止にだけ使う。戻り値を HTTP レスポンスに載せない。

import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { StorageObjectTable } from "../../../entities/drizzle";
import type { StorageObject } from "../../../entities/model";

export async function findStorageObjectById(id: string): Promise<StorageObject | null> {
  const rows = await db.select().from(StorageObjectTable).where(eq(StorageObjectTable.id, id)).limit(1);
  return (rows[0] as StorageObject | undefined) ?? null;
}
