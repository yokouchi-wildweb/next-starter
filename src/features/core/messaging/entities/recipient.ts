// src/features/core/messaging/entities/recipient.ts
//
// 回の受信者の一覧(D58): グループ宛ての回は送り始めの後、cron が 1 文の INSERT … SELECT で 1 つの時点の一員をここへ書き、
// 書き終えてからこの一覧だけから配達の行を作る(送る途中でグループが変わっても宛先は変わらない)。
// 全員・ロール宛ては書かない(送り始めの時刻の線で固定する)。回を消すと一緒に消える。

import { foreignKey, index, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";

import { UserTable } from "@/features/user/entities/drizzle";

import { MessageDispatchTable } from "./drizzle";

export const MessageDispatchRecipientTable = pgTable(
  "message_dispatch_recipients",
  {
    dispatch_id: uuid("dispatch_id").notNull(),
    user_id: uuid("user_id").notNull(),
  },
  (table) => [
    primaryKey({ name: "message_dispatch_recipients_pk", columns: [table.dispatch_id, table.user_id] }),
    foreignKey({ name: "msg_drecip_dispatch_fk", columns: [table.dispatch_id], foreignColumns: [MessageDispatchTable.id] }).onDelete("cascade"),
    foreignKey({ name: "msg_drecip_user_fk", columns: [table.user_id], foreignColumns: [UserTable.id] }).onDelete("cascade"),
    index("msg_drecip_user_idx").on(table.user_id),
  ],
);
