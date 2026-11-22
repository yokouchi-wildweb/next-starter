// 生成物・編集不可: pnpm generate extensions が src/domains/core/userGroup/extensionPoints.ts から生成する
// criteria: src/domains/core/userGroup/criteria/<名前>.ts(x) か <名前>/index.ts(x) の export const criterion(並びはファイル名の順)

import type { UserGroupCriterion } from "@/domains/userGroup/types";

import { criterion as criteria_hasTag } from "@/domains/core/userGroup/criteria/hasTag";
import { criterion as criteria_inStaticGroup } from "@/domains/core/userGroup/criteria/inStaticGroup";
import { criterion as criteria_lastLoginPeriod } from "@/domains/core/userGroup/criteria/lastLoginPeriod";
import { criterion as criteria_purchaseTotal } from "@/domains/core/userGroup/criteria/purchaseTotal";
import { criterion as criteria_signupPeriod } from "@/domains/core/userGroup/criteria/signupPeriod";

const criteriaList: UserGroupCriterion[] = [
  criteria_hasTag,
  criteria_inStaticGroup,
  criteria_lastLoginPeriod,
  criteria_purchaseTotal,
  criteria_signupPeriod,
];
export const criteria: Readonly<Record<string, UserGroupCriterion>> = Object.assign(Object.create(null), Object.fromEntries(criteriaList.map((item) => [String(item.key), item])));
if (Object.keys(criteria).length !== criteriaList.length) throw new Error("criteria: key が重複している項目がある");
