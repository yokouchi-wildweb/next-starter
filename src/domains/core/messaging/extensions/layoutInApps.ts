// 生成物・編集不可: pnpm generate extensions が src/domains/core/messaging/extensionPoints.ts から生成する
// layoutInApps: src/domains/core/messaging/layouts/*/inApp.tsx の export const inAppRenderer(folder = フォルダ名、並びはフォルダ名の順)

import type { MessageLayoutInAppRenderer } from "@/lib/messaging";

import { inAppRenderer as layoutInApps_alert } from "@/domains/core/messaging/layouts/alert/inApp";
import { inAppRenderer as layoutInApps_link } from "@/domains/core/messaging/layouts/link/inApp";
import { inAppRenderer as layoutInApps_notice } from "@/domains/core/messaging/layouts/notice/inApp";
import { inAppRenderer as layoutInApps_simple } from "@/domains/core/messaging/layouts/simple/inApp";
import { inAppRenderer as layoutInApps_statement } from "@/domains/core/messaging/layouts/statement/inApp";
import { inAppRenderer as layoutInApps_welcome } from "@/domains/core/messaging/layouts/welcome/inApp";

const layoutInAppsList: MessageLayoutInAppRenderer[] = [
  { ...layoutInApps_alert, folder: "alert" },
  { ...layoutInApps_link, folder: "link" },
  { ...layoutInApps_notice, folder: "notice" },
  { ...layoutInApps_simple, folder: "simple" },
  { ...layoutInApps_statement, folder: "statement" },
  { ...layoutInApps_welcome, folder: "welcome" },
];
export const layoutInApps: Readonly<Record<string, MessageLayoutInAppRenderer>> = Object.assign(Object.create(null), Object.fromEntries(layoutInAppsList.map((item) => [String(item.layout), item])));
if (Object.keys(layoutInApps).length !== layoutInAppsList.length) throw new Error("layoutInApps: layout が重複している項目がある");
