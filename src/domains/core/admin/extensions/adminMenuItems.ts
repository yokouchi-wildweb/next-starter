// 生成物・編集不可: pnpm generate extensions が src/domains/core/admin/extensionPoints.ts から生成する
// adminMenuItems: 差す側の <ドメイン>/plugs/adminMenuItems/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const item(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す。隣の <名前>.override.ts の hidden・label・icon・allowRoles・order・category を重ねる)

import type { AdminMenuItemDefinition } from "@/domains/core/admin/menu/types";

import { item as adminMenuItems_admin_dataMenu } from "@/domains/core/admin/plugs/adminMenuItems/dataMenu";
import { item as adminMenuItems_bankTransferReview_bankTransferReviews } from "@/domains/core/bankTransferReview/plugs/adminMenuItems/bankTransferReviews";
import { item as adminMenuItems_chatRoom_chatRooms } from "@/domains/core/chatRoom/plugs/adminMenuItems/chatRooms";
import { item as adminMenuItems_coupon_coupons } from "@/domains/core/coupon/plugs/adminMenuItems/coupons";
import { item as adminMenuItems_messaging_messagingDispatches } from "@/domains/core/messaging/plugs/adminMenuItems/messagingDispatches";
import { item as adminMenuItems_setting_settingSections } from "@/domains/core/setting/plugs/adminMenuItems/settingSections";
import { item as adminMenuItems_user_usersDemo } from "@/domains/core/user/plugs/adminMenuItems/usersDemo";
import { item as adminMenuItems_user_usersGeneral } from "@/domains/core/user/plugs/adminMenuItems/usersGeneral";
import { item as adminMenuItems_user_usersSystem } from "@/domains/core/user/plugs/adminMenuItems/usersSystem";
import { item as adminMenuItems_userGroup_userGroups } from "@/domains/core/userGroup/plugs/adminMenuItems/userGroups";
import { item as adminMenuItems_userTag_userTags } from "@/domains/core/userTag/plugs/adminMenuItems/userTags";

export const adminMenuItems: { domain: string | null; name: string; requires: readonly string[]; plug: AdminMenuItemDefinition }[] = [
  { domain: "admin", name: "dataMenu", requires: [], plug: adminMenuItems_admin_dataMenu },
  { domain: "bankTransferReview", name: "bankTransferReviews", requires: [], plug: adminMenuItems_bankTransferReview_bankTransferReviews },
  { domain: "chatRoom", name: "chatRooms", requires: [], plug: adminMenuItems_chatRoom_chatRooms },
  { domain: "coupon", name: "coupons", requires: [], plug: adminMenuItems_coupon_coupons },
  { domain: "messaging", name: "messagingDispatches", requires: [], plug: adminMenuItems_messaging_messagingDispatches },
  { domain: "setting", name: "settingSections", requires: [], plug: adminMenuItems_setting_settingSections },
  { domain: "user", name: "usersDemo", requires: [], plug: adminMenuItems_user_usersDemo },
  { domain: "user", name: "usersGeneral", requires: [], plug: adminMenuItems_user_usersGeneral },
  { domain: "user", name: "usersSystem", requires: [], plug: adminMenuItems_user_usersSystem },
  { domain: "userGroup", name: "userGroups", requires: [], plug: adminMenuItems_userGroup_userGroups },
  { domain: "userTag", name: "userTags", requires: [], plug: adminMenuItems_userTag_userTags },
];
