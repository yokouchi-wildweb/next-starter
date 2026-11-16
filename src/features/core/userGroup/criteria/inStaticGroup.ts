// src/features/core/userGroup/criteria/inStaticGroup.ts
// 上流の条件の部品: 静的グループの一員(user_group_members)。SQL で書けない条件を静的グループに書いて動的から使う口、
// 画面の「例外の人を足す・外す」(持ち主つきの静的グループ + not)もこれで表す。指す先が静的グループかは定義を保存する時に確かめる

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { UserTable } from "@/features/core/user/entities/drizzle";
import { UserGroupMemberTable } from "@/features/core/userGroup/entities/drizzle";
import type { UserGroupCriterion } from "@/features/userGroup/types";

const args = z.object({ groupId: z.string().uuid() }).strict();

export const criterion: UserGroupCriterion<typeof args> = {
  key: "inStaticGroup",
  label: "固定グループのメンバー",
  description: "選んだ固定グループのメンバー",
  args,
  fields: [{ name: "groupId", label: "固定グループ", formInput: "select" }],
  weight: "cheap",
  where: ({ groupId }) =>
    sql`exists (select 1 from ${UserGroupMemberTable} where ${and(
      eq(UserGroupMemberTable.group_id, groupId),
      eq(UserGroupMemberTable.user_id, UserTable.id),
    )})`,
};
