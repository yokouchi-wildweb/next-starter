// src/app/admin/(protected)/messaging/templates/[id]/_screen/loader.ts
// /admin/messaging/templates/[id] の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 認可(access 管理者カテゴリ)と門 messagingTemplates(閉なら notFound)とテンプレートの id を渡すだけ。
// 中身・保存・公開・取り下げ・版は部品 AdminMessageTemplateEditor が hook で行う(無い id は API が 404 を返し、部品が出す)

import "server-only";

import { notFound } from "next/navigation";

import { gate } from "@/featureGate";
import type { ScreenProps } from "@/lib/screens/types";
import { createLoader } from "@/app/admin/(protected)/guard";

export type AdminMessagingTemplateScreenParams = { id: string };

export type AdminMessagingTemplateScreenData = { templateId: string };

export const loadAdminMessagingTemplateScreen = createLoader({
  access: { roleCategories: ["admin"] },
  key: async (props: ScreenProps<AdminMessagingTemplateScreenParams>): Promise<[string]> => {
    const { id } = await props.params;
    return [id];
  },
  load: async (_ctx, id): Promise<AdminMessagingTemplateScreenData> => {
    if (!gate.enabled("messagingTemplates")) {
      notFound();
    }
    return { templateId: id };
  },
});
