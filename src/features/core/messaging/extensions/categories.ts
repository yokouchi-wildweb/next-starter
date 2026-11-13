// 生成物・編集不可: pnpm generate extensions が src/features/core/messaging/extensionPoints.ts から生成する
// categories: src/features/core/messaging/categories/<名前>.ts(x) か <名前>/index.ts(x) の export const category(並びはファイル名の順)

import type { MessageCategory } from "@/lib/messaging";

import { category as categories_accountLocked } from "@/features/core/messaging/categories/accountLocked";
import { category as categories_activity } from "@/features/core/messaging/categories/activity";
import { category as categories_announcement } from "@/features/core/messaging/categories/announcement";
import { category as categories_earlyRegistration } from "@/features/core/messaging/categories/earlyRegistration";
import { category as categories_emailChange } from "@/features/core/messaging/categories/emailChange";
import { category as categories_emailVerification } from "@/features/core/messaging/categories/emailVerification";
import { category as categories_marketing } from "@/features/core/messaging/categories/marketing";
import { category as categories_operatorDirect } from "@/features/core/messaging/categories/operatorDirect";
import { category as categories_passwordReset } from "@/features/core/messaging/categories/passwordReset";
import { category as categories_registrationComplete } from "@/features/core/messaging/categories/registrationComplete";
import { category as categories_walletAdjusted } from "@/features/core/messaging/categories/walletAdjusted";
import { category as categories_walletExpired } from "@/features/core/messaging/categories/walletExpired";
import { category as categories_walletExpiring } from "@/features/core/messaging/categories/walletExpiring";

const categoriesList: MessageCategory[] = [
  categories_accountLocked,
  categories_activity,
  categories_announcement,
  categories_earlyRegistration,
  categories_emailChange,
  categories_emailVerification,
  categories_marketing,
  categories_operatorDirect,
  categories_passwordReset,
  categories_registrationComplete,
  categories_walletAdjusted,
  categories_walletExpired,
  categories_walletExpiring,
];
export const categories: Readonly<Record<string, MessageCategory>> = Object.assign(Object.create(null), Object.fromEntries(categoriesList.map((item) => [String(item.key), item])));
if (Object.keys(categories).length !== categoriesList.length) throw new Error("categories: key が重複している項目がある");
