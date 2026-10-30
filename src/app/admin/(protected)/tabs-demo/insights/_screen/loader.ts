// src/app/admin/(protected)/tabs-demo/insights/_screen/loader.ts
// /admin/tabs-demo/insights(デモ)の loader。範囲 admin/(protected)(管理者カテゴリ) の createLoader で access だけを評価する。
// サーバー側の取得は無い(データの無い Screen にも access の loader を置く)。

import "server-only";

import { createLoader } from "@/app/admin/(protected)/guard";

export const loadAdminTabsDemoInsightsScreen = createLoader({
  access: { roleCategories: ["admin"] },
  load: async (): Promise<void> => {},
});
