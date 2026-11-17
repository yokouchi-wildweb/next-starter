// 生成物・編集不可: pnpm generate extensions が src/features/core/messaging/extensionPoints.ts から生成する
// systemTemplates: src/features/core/messaging/templates/<名前>.ts(x) か <名前>/index.ts(x) の export const systemTemplate(並びはファイル名の順)

import type { MessageSystemTemplate } from "@/lib/messaging";

import { systemTemplate as systemTemplates_announcement } from "@/features/core/messaging/templates/announcement";
import { systemTemplate as systemTemplates_announcementRich } from "@/features/core/messaging/templates/announcementRich";
import { systemTemplate as systemTemplates_direct } from "@/features/core/messaging/templates/direct";
import { systemTemplate as systemTemplates_directRich } from "@/features/core/messaging/templates/directRich";
import { systemTemplate as systemTemplates_promotion } from "@/features/core/messaging/templates/promotion";
import { systemTemplate as systemTemplates_promotionRich } from "@/features/core/messaging/templates/promotionRich";

const systemTemplatesList: MessageSystemTemplate[] = [
  systemTemplates_announcement,
  systemTemplates_announcementRich,
  systemTemplates_direct,
  systemTemplates_directRich,
  systemTemplates_promotion,
  systemTemplates_promotionRich,
];
export const systemTemplates: Readonly<Record<string, MessageSystemTemplate>> = Object.assign(Object.create(null), Object.fromEntries(systemTemplatesList.map((item) => [String(item.key), item])));
if (Object.keys(systemTemplates).length !== systemTemplatesList.length) throw new Error("systemTemplates: key が重複している項目がある");
