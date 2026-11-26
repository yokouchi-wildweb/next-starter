// src/domains/core/messaging/entities/messageDispatch/model.ts

import { MessageDispatchTable } from "./drizzle";
import { MESSAGE_DISPATCH_STATUSES } from "./schema";

export type MessageDispatch = typeof MessageDispatchTable.$inferSelect;
export type MessageDispatchInsert = typeof MessageDispatchTable.$inferInsert;
/** 送信ジョブの状態（値の意味は schema.ts の MESSAGE_DISPATCH_STATUSES を参照） */
export type MessageDispatchStatus = (typeof MESSAGE_DISPATCH_STATUSES)[number];
