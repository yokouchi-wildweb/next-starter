// src/domains/core/user/entities/userToUserTag/drizzle.ts

import { UserTable } from "../user/drizzle";
import { UserTagTable } from "@/domains/core/userTag/entities/drizzle";
import { index, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";

export const UserToUserTagTable = pgTable(
  "user_to_user_tag",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    userTagId: uuid("user_tag_id")
      .notNull()
      .references(() => UserTagTable.id, { onDelete: "cascade" }),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.userId, table.userTagId] }),
      // タグから利用者を引く(主キーは user_id が先なので tag だけの絞りに効かない。ユーザーグループのタグの部品)
      userTagIdx: index("user_to_user_tag_tag_idx").on(table.userTagId),
    };
  },
);
