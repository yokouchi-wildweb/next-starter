// 生成物・編集不可: pnpm generate extensions が src/domains/core/messaging/extensionPoints.ts から生成する
// categories: src/domains/core/messaging/categories/<名前>.ts(x) か <名前>/index.ts(x) の export const category(並びはファイル名の順)

import type { MessageCategory } from "@/lib/messaging";

import { category as categories_accountLocked } from "@/domains/core/messaging/categories/accountLocked";
import { category as categories_announcement } from "@/domains/core/messaging/categories/announcement";
import { category as categories_bankTransferCheck } from "@/domains/core/messaging/categories/bankTransferCheck";
import { category as categories_earlyRegistration } from "@/domains/core/messaging/categories/earlyRegistration";
import { category as categories_emailChange } from "@/domains/core/messaging/categories/emailChange";
import { category as categories_emailVerification } from "@/domains/core/messaging/categories/emailVerification";
import { category as categories_operatorDirect } from "@/domains/core/messaging/categories/operatorDirect";
import { category as categories_passwordReset } from "@/domains/core/messaging/categories/passwordReset";
import { category as categories_promotion } from "@/domains/core/messaging/categories/promotion";
import { category as categories_registrationComplete } from "@/domains/core/messaging/categories/registrationComplete";
import { category as categories_walletAdjusted } from "@/domains/core/messaging/categories/walletAdjusted";
import { category as categories_walletExpired } from "@/domains/core/messaging/categories/walletExpired";
import { category as categories_walletExpiring } from "@/domains/core/messaging/categories/walletExpiring";

const categoriesList: MessageCategory[] = [
  categories_accountLocked,
  categories_announcement,
  categories_bankTransferCheck,
  categories_earlyRegistration,
  categories_emailChange,
  categories_emailVerification,
  categories_operatorDirect,
  categories_passwordReset,
  categories_promotion,
  categories_registrationComplete,
  categories_walletAdjusted,
  categories_walletExpired,
  categories_walletExpiring,
];
export const categories: Readonly<Record<string, MessageCategory>> = Object.assign(Object.create(null), Object.fromEntries(categoriesList.map((item) => [String(item.key), item])));
if (Object.keys(categories).length !== categoriesList.length) throw new Error("categories: key が重複している項目がある");
