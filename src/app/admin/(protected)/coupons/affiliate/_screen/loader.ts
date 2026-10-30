// src/app/admin/(protected)/coupons/affiliate/_screen/loader.ts
// /admin/coupons/affiliate の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 admin/(protected)(管理者カテゴリ) の createLoader で access だけを評価する。サーバー側の取得は無い
// (データの無い Screen にも access の loader を置く)。

import "server-only";

import { createLoader } from "@/app/admin/(protected)/guard";

export const loadAdminCouponAffiliateListScreen = createLoader({
  access: { roleCategories: ["admin"] },
  load: async (): Promise<void> => {},
});
