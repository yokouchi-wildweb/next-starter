// src/app/admin/(protected)/messaging/templates/_screen/loader.ts
// /admin/messaging/templates の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 admin/(protected)/guard.ts の createLoader(access 管理者カテゴリ)。
// 住所は門の機能 messagingTemplates(既定 閉)が proxy で閉じる。ここでも閉なら notFound(proxy を通らない描画の備え)。
// 一覧は部品 AdminMessageTemplateList が hook で取る(カーソル)

import "server-only";

import { notFound } from "next/navigation";

import { gate } from "@/featureGate";
import { createLoader } from "@/app/admin/(protected)/guard";

export const loadAdminMessagingTemplateListScreen = createLoader({
  access: { roleCategories: ["admin"] },
  load: async (): Promise<void> => {
    if (!gate.enabled("messagingTemplates")) {
      notFound();
    }
  },
});
