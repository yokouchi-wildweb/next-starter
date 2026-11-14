// src/features/core/userGroup/criteria/lastLoginPeriod.ts
// 上流の条件の部品: 最後のログインの時期(users.last_authenticated_at)。from / to / 直近の日数、または N 日ログインしていない
// (notWithinDays。一度もログインしていない人も含む)

import { z } from "zod";

import { UserTable } from "@/features/core/user/entities/drizzle";
import type { UserGroupCriterion } from "@/features/userGroup/types";

import { andAll, notWithinDaysWhere, PERIOD_FIELDS, periodArgs, periodWhere } from "../utils/criteriaPeriod";

const args = periodArgs({ notWithinDays: z.number().int().min(1).max(3650).optional() });

export const criterion: UserGroupCriterion<typeof args> = {
  key: "lastLoginPeriod",
  label: "最後のログインの時期",
  description: "最後にログインした日時がこの期間の利用者(または N 日ログインしていない利用者)",
  args,
  fields: [
    ...PERIOD_FIELDS,
    {
      name: "notWithinDays",
      label: "ログインしていない日数",
      formInput: "numberInput",
      helperText: "評価する時点から何日ログインしていないか(一度もログインしていない人も含む)",
    },
  ],
  weight: "cheap",
  where: ({ notWithinDays, ...period }, { now }) =>
    andAll([
      ...periodWhere(UserTable.lastAuthenticatedAt, period, now),
      ...(notWithinDays !== undefined ? [notWithinDaysWhere(UserTable.lastAuthenticatedAt, notWithinDays, now)] : []),
    ]),
};
