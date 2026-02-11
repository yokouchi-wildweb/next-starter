// src/features/user/services/server/drizzleBase.ts

import { UserTable, UserToUserTagTable } from "@/features/core/user/entities/drizzle";
import { UserTagTable } from "@/features/core/userTag/entities/drizzle";
import { UserCoreSchema } from "@/features/core/user/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { z } from "zod";

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/user/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const baseOptions = {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
  defaultSearchFields: ["name", "email"],
  useSoftDelete: true,
  belongsToManyRelations: [
    {
      fieldName: "user_tag_ids",
      throughTable: UserToUserTagTable,
      sourceColumn: UserToUserTagTable.userId,
      targetColumn: UserToUserTagTable.userTagId,
      sourceProperty: "userId",
      targetProperty: "userTagId",
    },
  ],
  belongsToManyObjectRelations: [
    {
      field: "user_tags",
      targetTable: UserTagTable,
      throughTable: UserToUserTagTable,
      sourceColumn: UserToUserTagTable.userId,
      targetColumn: UserToUserTagTable.userTagId,
    },
  ],
  countableRelations: [
    {
      field: "user_tags",
      throughTable: UserToUserTagTable,
      foreignKey: "userId",
    },
  ],
} satisfies DrizzleCrudServiceOptions<z.infer<typeof UserCoreSchema>>;

export const base = createCrudService(UserTable, baseOptions);
