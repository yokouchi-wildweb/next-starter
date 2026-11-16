// src/features/core/userGroup/criteria/status.ts
// 上流の条件の部品: 利用者の状態(どれかの状態。利用できる人だけにしたい時は「有効」を選ぶ)

import { inArray } from "drizzle-orm";
import { z } from "zod";

import { USER_STATUSES, USER_STATUS_LABELS } from "@/features/core/user/constants/status";
import { UserTable } from "@/features/core/user/entities/drizzle";
import type { UserGroupCriterion } from "@/features/userGroup/types";

const args = z.object({ statuses: z.array(z.enum(USER_STATUSES)).min(1) }).strict();

export const criterion: UserGroupCriterion<typeof args> = {
  key: "status",
  label: "アカウントの状態",
  description: "選んだ状態のいずれかのユーザー",
  args,
  fields: [{ name: "statuses", label: "状態", formInput: "multiSelect", options: USER_STATUSES.map((value) => ({ value, label: USER_STATUS_LABELS[value] })) }],
  weight: "cheap",
  where: ({ statuses }) => inArray(UserTable.status, statuses),
};
