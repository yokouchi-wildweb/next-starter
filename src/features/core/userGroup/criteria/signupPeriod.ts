// src/features/core/userGroup/criteria/signupPeriod.ts
// 上流の条件の部品: 登録の時期(users.created_at)。from / to / 直近の日数のどれか(重ねると and)

import { UserTable } from "@/features/core/user/entities/drizzle";
import type { UserGroupCriterion } from "@/features/userGroup/types";

import { andAll, PERIOD_FIELDS, periodArgs, periodWhere } from "../utils/criteriaPeriod";

const args = periodArgs();

export const criterion: UserGroupCriterion<typeof args> = {
  key: "signupPeriod",
  label: "登録の時期",
  description: "会員登録した日時がこの期間の利用者",
  args,
  fields: PERIOD_FIELDS,
  weight: "cheap",
  where: (value, { now }) => andAll(periodWhere(UserTable.createdAt, value, now)),
};
