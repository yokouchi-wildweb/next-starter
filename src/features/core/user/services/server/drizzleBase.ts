// src/features/user/services/server/drizzleBase.ts

import { UserTable, UserToUserTagTable } from "@/features/core/user/entities/drizzle";
import { UserTagTable } from "@/features/core/userTag/entities/drizzle";
import { UserCoreSchema } from "@/features/core/user/entities/schema";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import { getDomainConfig } from "@/lib/domain";
import type { z } from "zod";

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/user/services/server/wrappers/ 以下にラップを作成して差し替えること。

const conf = getDomainConfig("user");

export const baseOptions = {
  idType: "uuid",
  // セッションユーザー行は 1 リクエスト内で認可ガード・各サブシステムから繰り返し
  // 読まれる高 fan-in 行のため、リクエストスコープでメモ化する（get の id 指定・
  // オプションなし呼び出しのみ）。書き込みメソッドは自動 invalidate される。
  // 生 SQL で UserTable を書くコードは直後に base.invalidateRequestMemo() を呼ぶこと。
  requestMemo: true,
  defaultOrderBy: [["createdAt", "DESC"]],
  defaultSearchFields: conf.searchFields,
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
  // 監査対象は wrapper で明示記録していない情報変更系のみに絞る。
  // status / role / 削除系は changeStatus / changeRole / softDelete / hardDelete
  // 等の wrapper が個別 action ("user.status.changed" 等) で記録するため、
  // ここで重複させない。
  audit: {
    enabled: true,
    targetType: "user",
    actionPrefix: "user",
    trackedFields: ["email", "name", "phoneNumber", "adminMemo"],
    bulkMode: "detail",
    retentionDays: 730,
    recorder: auditLogger,
  },
} satisfies DrizzleCrudServiceOptions<z.infer<typeof UserCoreSchema>>;

export const base = createCrudService(UserTable, baseOptions);
