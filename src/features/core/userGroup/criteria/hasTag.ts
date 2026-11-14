// src/features/core/userGroup/criteria/hasTag.ts
// 上流の条件の部品: タグを持つ(user_to_user_tag)。match any = どれか 1 つ / all = 全部

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { UserTable, UserToUserTagTable } from "@/features/core/user/entities/drizzle";
import type { UserGroupCriterion } from "@/features/userGroup/types";

const args = z
  .object({ tagIds: z.array(z.string().uuid()).min(1).max(50), match: z.enum(["any", "all"]).default("any") })
  .strict();

export const criterion: UserGroupCriterion<typeof args> = {
  key: "hasTag",
  label: "タグ",
  description: "選んだタグを持つ利用者(どれか 1 つ / 全部)",
  args,
  fields: [
    { name: "tagIds", label: "タグ", formInput: "multiSelect", helperText: "選択肢は管理画面がタグの一覧から出す" },
    {
      name: "match",
      label: "合わせ方",
      formInput: "radio",
      options: [
        { value: "any", label: "どれか 1 つ" },
        { value: "all", label: "全部" },
      ],
      defaultValue: "any",
    },
  ],
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
