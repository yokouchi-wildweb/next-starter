// src/features/core/messaging/services/server/overrides/store.ts

import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { MessageOverrideTable } from "../../../entities/override";
import type { MessageOverrideRecord, MessageOverrideStore } from "./types";

const columns = {
  messageKey: MessageOverrideTable.message_key,
  fieldPath: MessageOverrideTable.field_path,
  layoutVersion: MessageOverrideTable.layout_version,
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
  async upsert({ messageKey, fieldPath, layoutVersion, value, codeValue, updatedBy }, bind) {
    await db.transaction(async (tx) => {
      const now = new Date();
      const [current] = await tx
        .select({ id: MessageOverrideTable.id, value: MessageOverrideTable.value })
        .from(MessageOverrideTable)
        .where(and(eq(MessageOverrideTable.message_key, messageKey), eq(MessageOverrideTable.field_path, fieldPath)))
        .for("update")
        .limit(1);
      const rowId = current?.id ?? randomUUID();
      const written = bind ? await bind(tx, { rowId, previousValue: current?.value ?? null }) : value;
      await tx
        .insert(MessageOverrideTable)
        .values({
          id: rowId,
          message_key: messageKey,
          field_path: fieldPath,
          layout_version: layoutVersion,
          value: written,
          code_value: codeValue ?? null,
          updated_by: updatedBy,
        })
        .onConflictDoUpdate({
          target: [MessageOverrideTable.message_key, MessageOverrideTable.field_path],
          set: { value: written, layout_version: layoutVersion, code_value: codeValue ?? null, updated_by: updatedBy, updatedAt: now },
        });
    });
  },
  async remove(messageKey, fieldPath, release) {
    return db.transaction(async (tx) => {
      const deleted = await tx
        .delete(MessageOverrideTable)
        .where(and(eq(MessageOverrideTable.message_key, messageKey), eq(MessageOverrideTable.field_path, fieldPath)))
        .returning({ id: MessageOverrideTable.id, value: MessageOverrideTable.value });
      if (deleted.length === 0) return false;
      if (release) for (const row of deleted) await release(tx, { rowId: row.id, value: row.value });
      return true;
    });
  },
  async apply(messageKey, { removals, upserts }, hooks = {}) {
    await db.transaction(async (tx) => {
      for (const fieldPath of removals) {
        const deleted = await tx
          .delete(MessageOverrideTable)
          .where(and(eq(MessageOverrideTable.message_key, messageKey), eq(MessageOverrideTable.field_path, fieldPath)))
          .returning({ id: MessageOverrideTable.id, value: MessageOverrideTable.value });
        if (hooks.release) for (const row of deleted) await hooks.release(tx, { rowId: row.id, value: row.value });
      }
      const now = new Date();
      for (const { fieldPath, layoutVersion, value, codeValue, updatedBy } of upserts) {
        const [current] = await tx
          .select({ id: MessageOverrideTable.id, value: MessageOverrideTable.value })
          .from(MessageOverrideTable)
          .where(and(eq(MessageOverrideTable.message_key, messageKey), eq(MessageOverrideTable.field_path, fieldPath)))
          .for("update")
          .limit(1);
        const rowId = current?.id ?? randomUUID();
        const written = hooks.bind ? await hooks.bind(tx, { fieldPath, rowId, previousValue: current?.value ?? null, value }) : value;
        await tx
          .insert(MessageOverrideTable)
          .values({
            id: rowId,
            message_key: messageKey,
            field_path: fieldPath,
            layout_version: layoutVersion,
            value: written,
            code_value: codeValue ?? null,
            updated_by: updatedBy,
          })
          .onConflictDoUpdate({
            target: [MessageOverrideTable.message_key, MessageOverrideTable.field_path],
            set: { value: written, layout_version: layoutVersion, code_value: codeValue ?? null, updated_by: updatedBy, updatedAt: now },
          });
      }
    });
  },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 渡した id のうち、上書きの行がまだある id(uuid の形でない id は「無い」)。
 * storage の照合(cron storage-sweep)が record_type messaging.override の有無の関数として使う
 */
export async function existingOverrideIds(ids: readonly string[]): Promise<ReadonlySet<string>> {
  const candidates = [...new Set(ids.filter((id) => UUID.test(id)))];
  if (candidates.length === 0) return new Set();
  const rows = await db
    .select({ id: MessageOverrideTable.id })
    .from(MessageOverrideTable)
    .where(inArray(MessageOverrideTable.id, candidates));
  return new Set(rows.map((row) => row.id));
}
