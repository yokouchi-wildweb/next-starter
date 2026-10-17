// src/features/core/admin/services/server/loaders/adminEdit.ts
// dc:generate が生成する管理画面(編集)の共有 loader。一覧・規則: ./README.md

import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";

import { resolveReturnTo } from "@/lib/crud/utils/paths";

/** 編集 loader が service に要求する最小の形(createCrudService の get。null / undefined = 存在しない) */
export type AdminEditService<T> = {
  get(id: string): Promise<T | null | undefined>;
};

export type AdminEditScreenParams = { id: string };
export type AdminEditScreenSearchParams = { returnTo?: string };

/** 編集画面の props(ScreenProps<AdminEditScreenParams, AdminEditScreenSearchParams> と互換) */
export type AdminEditScreenProps = {
  params: Promise<AdminEditScreenParams>;
  searchParams: Promise<AdminEditScreenSearchParams>;
};

export type AdminEditScreenData<T> = {
  id: string;
  /** 対象レコード(無ければ loader が notFound する) */
  record: NonNullable<T>;
  /** 保存後の戻り先(?returnTo= を検証済み。無ければ fallbackPath) */
  redirectPath: string;
};

const resolveAdminEditScreen = cache(
  async <T,>(service: AdminEditService<T>, id: string, returnTo: string | undefined, fallbackPath: string): Promise<AdminEditScreenData<T>> => {
    const record = await service.get(id);
    if (!record) {
      notFound();
    }
    return { id, record, redirectPath: resolveReturnTo(returnTo, fallbackPath) };
  },
);

/**
 * 生成された管理画面(編集)のデータ。レコードが無ければ 404。
 * 認可は admin/(protected)/layout.tsx の authGuard が担うため、ここでは行わない。
 * @param fallbackPath `?returnTo=` が無い/不正なときの戻り先(例: "/admin/samples")
 */
export async function loadAdminEditScreen<T>(
  service: AdminEditService<T>,
  props: AdminEditScreenProps,
  fallbackPath: string,
): Promise<AdminEditScreenData<T>> {
  const [{ id }, { returnTo }] = await Promise.all([props.params, props.searchParams]);
  return resolveAdminEditScreen(service, id, returnTo, fallbackPath);
}
