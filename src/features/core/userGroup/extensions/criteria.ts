// 生成物・編集不可: pnpm generate extensions が src/features/core/userGroup/extensionPoints.ts から生成する
// criteria: src/features/core/userGroup/criteria/<名前>.ts(x) か <名前>/index.ts(x) の export const criterion(並びはファイル名の順)

import type { UserGroupCriterion } from "@/features/userGroup/types";

const criteriaList: UserGroupCriterion[] = [];
export const criteria: Readonly<Record<string, UserGroupCriterion>> = Object.assign(Object.create(null), Object.fromEntries(criteriaList.map((item) => [String(item.key), item])));
if (Object.keys(criteria).length !== criteriaList.length) throw new Error("criteria: key が重複している項目がある");
