// src/features/core/adminCommand/base/loadForAdmin.ts

import type { AdminCommandPlugin, CategoryConfig, LazyItem } from "./types";

export type AdminCommandLists = {
  categories: readonly LazyItem<CategoryConfig>[];
  plugins: readonly LazyItem<AdminCommandPlugin>[];
};

export type LoadedAdminCommand = {
  categories: CategoryConfig[];
  plugins: AdminCommandPlugin[];
};

/** 管理者のときだけ項目を読み込む(それ以外は何も読まず null) */
export async function loadForAdmin(isAdmin: boolean, lists: AdminCommandLists): Promise<LoadedAdminCommand | null> {
  if (!isAdmin) return null;
  const [categories, plugins] = await Promise.all([
    Promise.all(lists.categories.map((item) => item.load())),
    Promise.all(lists.plugins.map((item) => item.load())),
  ]);
  return { categories, plugins };
}
