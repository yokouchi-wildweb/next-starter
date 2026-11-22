// src/domains/core/userGroup/criteria/signupPeriod.ts
// 上流の条件の部品: 登録の時期(users.created_at)。from / to / 直近の日数のどれか(重ねると and)

import { UserTable } from "@/domains/core/user/entities/drizzle";
import type { UserGroupCriterion } from "@/domains/userGroup/types";

import { andAll, PERIOD_FIELDS, PERIOD_INLINE_GROUPS, periodArgs, periodWhere } from "../utils/criteriaPeriod";

const args = periodArgs();

export const criterion: UserGroupCriterion<typeof args> = {
  key: "signupPeriod",
  label: "登録日",
  description: "会員登録した日時がこの期間のユーザー",
  args,
  fields: PERIOD_FIELDS,
  inlineGroups: PERIOD_INLINE_GROUPS,
  weight: "cheap",
  where: (value, { now }) => andAll(periodWhere(UserTable.createdAt, value, now)),
};
