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
  for (const [label, ids] of [["カテゴリ", categories.map((c) => c.id)], ["プラグイン", plugins.map((p) => p.id)]] as const) {
    const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
    if (duplicate) throw new Error(`管理者コマンドの${label} "${duplicate}" が複数あります`);
  }
  return { categories, plugins };
}
