// src/domains/core/messaging/entities/messageDispatchRecipient/drizzle.ts

import { MessageDispatchTable } from "../messageDispatch/drizzle";
import { UserTable } from "@/domains/user/entities/drizzle";
import { foreignKey, index, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";

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
