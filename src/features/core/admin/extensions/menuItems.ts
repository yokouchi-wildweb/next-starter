// 生成物・編集不可: pnpm generate extensions が src/features/core/admin/extensionPoints.ts から生成する
// menuItems: src/features/core/admin/menu/items/<名前>.ts(x) か <名前>/index.ts(x) の export const item(並びはファイル名の順)

import type { AdminMenuItemDefinition } from "@/features/core/admin/menu/types";

import { item as menuItems_bankTransferReviews } from "@/features/core/admin/menu/items/bankTransferReviews";
import { item as menuItems_chatRooms } from "@/features/core/admin/menu/items/chatRooms";
import { item as menuItems_coupons } from "@/features/core/admin/menu/items/coupons";
import { item as menuItems_dataMenu } from "@/features/core/admin/menu/items/dataMenu";
import { item as menuItems_messagingDispatches } from "@/features/core/admin/menu/items/messagingDispatches";
import { item as menuItems_notificationTemplates } from "@/features/core/admin/menu/items/notificationTemplates";
import { item as menuItems_notifications } from "@/features/core/admin/menu/items/notifications";
import { item as menuItems_settingSections } from "@/features/core/admin/menu/items/settingSections";
import { item as menuItems_userTags } from "@/features/core/admin/menu/items/userTags";
import { item as menuItems_usersDemo } from "@/features/core/admin/menu/items/usersDemo";
import { item as menuItems_usersGeneral } from "@/features/core/admin/menu/items/usersGeneral";
import { item as menuItems_usersSystem } from "@/features/core/admin/menu/items/usersSystem";

const menuItemsList: AdminMenuItemDefinition[] = [
  menuItems_bankTransferReviews,
  menuItems_chatRooms,
  menuItems_coupons,
  menuItems_dataMenu,
  menuItems_messagingDispatches,
  menuItems_notificationTemplates,
  menuItems_notifications,
  menuItems_settingSections,
  menuItems_userTags,
  menuItems_usersDemo,
  menuItems_usersGeneral,
  menuItems_usersSystem,
];
export const menuItems: Readonly<Record<string, AdminMenuItemDefinition>> = Object.assign(Object.create(null), Object.fromEntries(menuItemsList.map((item) => [String(item.key), item])));
if (Object.keys(menuItems).length !== menuItemsList.length) throw new Error("menuItems: key が重複している項目がある");
