// src/features/core/admin/services/server/screenData/adminEdit.ts
// 管理画面(編集)の取得本体。認可と cache は呼び手(ルートの _screen/loader.ts)が持つ。
// service は外から受ける(結ぶのは src/wiring/adminScreenParts.ts の adminEditParts)。一覧・規則: ./README.md

import "server-only";
import { notFound } from "next/navigation";

import { resolveReturnTo } from "@/lib/crud/utils/paths";

/** 編集が service に要求する最小の形(createCrudService の get。null / undefined = 存在しない) */
export type AdminEditService<T> = {
  get(id: string): Promise<T | null | undefined>;
};

export type AdminEditScreenParams = { id: string };
export type AdminEditScreenSearchParams = { returnTo?: string };

export type AdminEditScreenData<T> = {
  id: string;
  /** 対象レコード(無ければ notFound) */
  record: NonNullable<T>;
  /** 保存後の戻り先(?returnTo= を検証済み。無ければ fallbackPath) */
  redirectPath: string;
};

/** レコードを引く。無ければ 404 */
export async function fetchAdminEdit<T>(
  service: AdminEditService<T>,
  id: string,
  returnTo: string | undefined,
  fallbackPath: string,
): Promise<AdminEditScreenData<T>> {
  const record = await service.get(id);
  if (!record) {
    notFound();
  }
  return { id, record, redirectPath: resolveReturnTo(returnTo, fallbackPath) };
}
