// 生成物・編集不可: pnpm generate extensions が src/domains/core/user/extensionPoints.ts から生成する
// adminManageTabs: src/domains/core/user/adminManageTabs/<名前>.ts(x) か <名前>/index.ts(x) の export const tab(並びはファイル名の順)

import type { UserAdminManageTabItem } from "@/domains/core/user/types";

const adminManageTabsList: UserAdminManageTabItem[] = [];
export const adminManageTabs: Readonly<Record<string, UserAdminManageTabItem>> = Object.assign(Object.create(null), Object.fromEntries(adminManageTabsList.map((item) => [String(item.key), item])));
if (Object.keys(adminManageTabs).length !== adminManageTabsList.length) throw new Error("adminManageTabs: key が重複している項目がある");
