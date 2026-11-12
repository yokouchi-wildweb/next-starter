// src/app/admin/(protected)/messaging/overrides/[key]/_screen/loader.ts
// /admin/messaging/overrides/[key] の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 認可(access 管理者カテゴリ)と門 messagingOverrides(閉なら notFound)と連絡の鍵を渡すだけ。
// 欄・保存・既定に戻すは部品 AdminMessageOverrideEditor が hook で行う(知らない鍵は API が 404 を返し、部品が出す)

import "server-only";

import { notFound } from "next/navigation";

import { gate } from "@/featureGate";
import type { ScreenProps } from "@/lib/screens/types";
import { createLoader } from "@/app/admin/(protected)/guard";

export type AdminMessagingOverrideScreenParams = { key: string };

export type AdminMessagingOverrideScreenData = { messageKey: string };

export const loadAdminMessagingOverrideScreen = createLoader({
  access: { roleCategories: ["admin"] },
  key: async (props: ScreenProps<AdminMessagingOverrideScreenParams>): Promise<[string]> => {
    const { key } = await props.params;
    return [key];
  },
  load: async (_ctx, key): Promise<AdminMessagingOverrideScreenData> => {
    if (!gate.enabled("messagingOverrides")) {
      notFound();
    }
    return { messageKey: decodeURIComponent(key) };
  },
});
