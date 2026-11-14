// src/features/core/userGroup/criteria/role.ts
// 上流の条件の部品: ロール(どれかのロール)

import { inArray } from "drizzle-orm";
import { z } from "zod";

import { roles as ALL_ROLES } from "@/features/core/user/extensions/roles";
import { UserTable } from "@/features/core/user/entities/drizzle";
import type { UserGroupCriterion } from "@/features/userGroup/types";

const args = z.object({ roles: z.array(z.string().min(1)).min(1).max(50) }).strict();

export const criterion: UserGroupCriterion<typeof args> = {
  key: "role",
  label: "ロール",
  description: "選んだロールのどれかの利用者",
  args,
  fields: [{ name: "roles", label: "ロール", formInput: "multiSelect", options: ALL_ROLES.map((role) => ({ value: role.id, label: role.label })) }],
  weight: "cheap",
  where: ({ roles }) => inArray(UserTable.role, roles as (typeof UserTable.role.enumValues)[number][]),
};
