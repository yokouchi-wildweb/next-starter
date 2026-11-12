// src/features/core/messaging/services/server/overrides/store.ts

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { MessageOverrideTable } from "../../../entities/override";
import type { MessageOverrideRecord, MessageOverrideStore } from "./types";

const columns = {
  messageKey: MessageOverrideTable.message_key,
  fieldPath: MessageOverrideTable.field_path,
  value: MessageOverrideTable.value,
  codeValue: MessageOverrideTable.code_value,
  updatedBy: MessageOverrideTable.updated_by,
  updatedAt: MessageOverrideTable.updatedAt,
};

export const drizzleMessageOverrideStore: MessageOverrideStore = {
  async listByMessage(messageKey) {
    return (await db
      .select(columns)
      .from(MessageOverrideTable)
      .where(eq(MessageOverrideTable.message_key, messageKey))) as MessageOverrideRecord[];
  },
  async listAll() {
    return (await db.select(columns).from(MessageOverrideTable)) as MessageOverrideRecord[];
  },
  async upsert({ messageKey, fieldPath, value, codeValue, updatedBy }) {
    const now = new Date();
    await db
      .insert(MessageOverrideTable)
      .values({ message_key: messageKey, field_path: fieldPath, value, code_value: codeValue ?? null, updated_by: updatedBy })
      .onConflictDoUpdate({
        target: [MessageOverrideTable.message_key, MessageOverrideTable.field_path],
        set: { value, code_value: codeValue ?? null, updated_by: updatedBy, updatedAt: now },
      });
  },
  async remove(messageKey, fieldPath) {
    const deleted = await db
      .delete(MessageOverrideTable)
      .where(and(eq(MessageOverrideTable.message_key, messageKey), eq(MessageOverrideTable.field_path, fieldPath)))
      .returning({ id: MessageOverrideTable.id });
    return deleted.length > 0;
  },
};
