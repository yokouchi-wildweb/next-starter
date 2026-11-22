// src/domains/core/userGroup/criteria/hasTag.ts
// 上流の条件の部品: タグを持つ(user_to_user_tag)。match any = どれか 1 つ / all = 全部

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { UserTable, UserToUserTagTable } from "@/domains/core/user/entities/drizzle";
import type { UserGroupCriterion } from "@/domains/userGroup/types";

const args = z
  .object({ tagIds: z.array(z.string().uuid()).min(1).max(50), match: z.enum(["any", "all"]).default("any") })
  .strict();

export const criterion: UserGroupCriterion<typeof args> = {
  key: "hasTag",
  label: "タグ",
  description: "選んだタグを持つユーザー",
  args,
  fields: [
    { name: "tagIds", label: "タグ", formInput: "multiSelect" },
    {
      name: "match",
      label: "一致条件",
      formInput: "radio",
      options: [
        { value: "any", label: "いずれかのタグを持つ" },
        { value: "all", label: "すべてのタグを持つ" },
      ],
      defaultValue: "any",
    },
  ],
  inlineGroups: [{ key: "tag", label: "タグ", fields: ["tagIds", "match"] }],
  weight: "cheap",
  where: ({ tagIds, match }) => {
    const tags = [...new Set(tagIds)];
    if (match === "all") {
      // 選んだタグの数だけ持っている(user_to_user_tag の主キーで重なりは無い)
      return sql`(select count(*) from ${UserToUserTagTable} where ${and(
        eq(UserToUserTagTable.userId, UserTable.id),
        inArray(UserToUserTagTable.userTagId, tags),
      )}) = ${tags.length}`;
    }
    return sql`exists (select 1 from ${UserToUserTagTable} where ${and(
      eq(UserToUserTagTable.userId, UserTable.id),
      inArray(UserToUserTagTable.userTagId, tags),
    )})`;
  },
};
