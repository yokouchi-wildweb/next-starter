// src/domains/core/user/services/server/userBase.ts

import { UserTable, UserToUserTagTable } from "@/domains/core/user/entities/drizzle";
import { UserTagTable } from "@/domains/core/userTag/entities/drizzle";
import { UserCoreSchema } from "@/domains/core/user/entities/schema";
import { auditLogger } from "@/domains/core/auditLog/services/server";
import { storageBindingFor } from "@/domains/core/storageObject/services/server/crudBinding";
import { createCrudService } from "@/lib/crud/server";
import type { CrudServiceOptions } from "@/lib/crud/server";
import { normalizeEntityDeclaration } from "@/lib/domain";
import type { DomainConfigOptionals } from "@/lib/domain";
import rawConf from "@/domains/user/entities/user/entity.json";
import type { z } from "zod";

// NOTE: userBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/domains/user/services/server/wrappers/ 以下にラップを作成して差し替えること。

const conf = normalizeEntityDeclaration(rawConf) as typeof rawConf & DomainConfigOptionals;

export const baseOptions = {
  idType: "uuid",
  // セッションユーザー行は 1 リクエスト内で認可ガード・各サブシステムから繰り返し
  // 読まれる高 fan-in 行のため、リクエストスコープでメモ化する（get の id 指定・
  // オプションなし呼び出しのみ）。書き込みメソッドは自動 invalidate される。
  // 生 SQL で UserTable を書くコードは直後に base.invalidateRequestMemo() を呼ぶこと。
  requestMemo: true,
  defaultOrderBy: [["createdAt", "DESC"]],
  defaultSearchFields: conf.searchFields,
  // 関連度ランキング（searchRank: true 時の重み）。ピッカーで「ab」と打ったとき、
  // 名前の前置一致がメールドメインの部分一致に埋もれないよう name を重くする。
  // 採点対象は呼び出し側 searchFields との交差に限定される（picker 既定は name/email）。
  defaultSearchRank: {
    fields: [{ field: "name", weight: 3 }, "email", "phoneNumber"],
  },
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
      idField: "user_tag_ids",
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
  // アバター（ref）をファイル台帳に紐付ける。物理削除で紐付けを外し、commit 後に実物を消す（D41）。
  // 退会（論理削除）では何もしない（復帰できるようにファイルを残す、D45）
  storage: storageBindingFor("user", [{ name: "avatarUrl", purpose: "user.avatar", multi: false }]),
} satisfies CrudServiceOptions<z.infer<typeof UserCoreSchema>>;

export const userBase = createCrudService(UserTable, baseOptions);
