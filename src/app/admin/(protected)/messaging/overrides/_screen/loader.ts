// src/app/admin/(protected)/messaging/overrides/_screen/loader.ts
// /admin/messaging/overrides の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 admin/(protected)/guard.ts の createLoader(access 管理者カテゴリ)。遷移制御だけ(Promise<void>)。
// 住所は門の機能 messagingOverrides(既定 閉)が proxy で閉じる。ここでも閉なら notFound(proxy を通らない描画の備え)。
// 一覧は部品 AdminMessageOverrideList が hook で取る

import "server-only";

import { notFound } from "next/navigation";

import { gate } from "@/featureGate";
import { createLoader } from "@/app/admin/(protected)/guard";

export const loadAdminMessagingOverrideListScreen = createLoader({
  access: { roleCategories: ["admin"] },
  load: async (): Promise<void> => {
    if (!gate.enabled("messagingOverrides")) {
      notFound();
    }
  },
});
