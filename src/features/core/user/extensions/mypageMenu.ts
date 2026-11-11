// 生成物・編集不可: pnpm generate extensions が src/features/core/user/extensionPoints.ts から生成する
// mypageMenu: src/features/core/user/mypageMenu/items/<名前>.ts(x) か <名前>/index.ts(x) の export const item(並びはファイル名の順)

import type { MypageMenuItem } from "@/features/core/user/types";

import { item as mypageMenu_account } from "@/features/core/user/mypageMenu/items/account";
import { item as mypageMenu_invite } from "@/features/core/user/mypageMenu/items/invite";
import { item as mypageMenu_logout } from "@/features/core/user/mypageMenu/items/logout";
import { item as mypageMenu_notifications } from "@/features/core/user/mypageMenu/items/notifications";
import { item as mypageMenu_other } from "@/features/core/user/mypageMenu/items/other";

const mypageMenuList: MypageMenuItem[] = [
  mypageMenu_account,
  mypageMenu_invite,
  mypageMenu_logout,
  mypageMenu_notifications,
  mypageMenu_other,
];
export const mypageMenu: Readonly<Record<string, MypageMenuItem>> = Object.assign(Object.create(null), Object.fromEntries(mypageMenuList.map((item) => [String(item.key), item])));
if (Object.keys(mypageMenu).length !== mypageMenuList.length) throw new Error("mypageMenu: key が重複している項目がある");
