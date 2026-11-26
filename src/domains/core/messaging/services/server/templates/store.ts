// src/domains/core/messaging/services/server/templates/store.ts

import { and, desc, eq, ilike, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";

import { db, type TransactionClient } from "@/lib/drizzle";

import { MessageDispatchTable } from "../../../entities/drizzle";
import { MessageTemplateTable, MessageTemplateVersionTable } from "../../../entities/drizzle";
import { ilikeContains, jsonbTextContains } from "../admin/textSearch";
import type { MessageTemplateStore } from "./types";

export const drizzleMessageTemplateStore: MessageTemplateStore<TransactionClient> = {
  transaction: (run) => db.transaction((tx) => run(tx)),
  async list({ categories, q, limit, after }) {
    if (categories && categories.length === 0) return [];
    const conditions = [
      categories ? inArray(MessageTemplateTable.category, [...categories]) : undefined,
      // 文字: 名前か欄の中身の文字列(欄の名前は探さない)
      q ? or(ilike(MessageTemplateTable.name, ilikeContains(q)), jsonbTextContains(MessageTemplateTable.values, q, "deep")) : undefined,
      after
        ? or(
            lt(MessageTemplateTable.createdAt, after.createdAt),
            and(eq(MessageTemplateTable.createdAt, after.createdAt), lt(MessageTemplateTable.id, after.id)),
          )
        : undefined,
    ].filter((condition) => condition !== undefined);
    return db
      .select()
      .from(MessageTemplateTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(MessageTemplateTable.createdAt), desc(MessageTemplateTable.id))
      .limit(limit + 1);
  },
  async find(id) {
    const [row] = await db.select().from(MessageTemplateTable).where(eq(MessageTemplateTable.id, id)).limit(1);
    return row ?? null;
  },
  async findByKey(key) {
    const [row] = await db.select().from(MessageTemplateTable).where(eq(MessageTemplateTable.key, key)).limit(1);
    return row ?? null;
  },
  async lockForUpdate(tx, id) {
    const [row] = await tx.select().from(MessageTemplateTable).where(eq(MessageTemplateTable.id, id)).limit(1).for("update");
    return row ?? null;
  },
  async insert(tx, values) {
    const [row] = await tx.insert(MessageTemplateTable).values(values).returning();
    return row;
  },
  async remove(tx, id) {
    await tx.delete(MessageTemplateTable).where(eq(MessageTemplateTable.id, id));
  },
  async lockKeptDispatches(tx, templateId) {
    const rows = await tx
      .select({
        id: MessageDispatchTable.id,
        actor_id: MessageDispatchTable.actor_id,
        metadata: MessageDispatchTable.metadata,
        values: MessageDispatchTable.values,
      })
      .from(MessageDispatchTable)
      .where(
        and(
          eq(MessageDispatchTable.template_id, templateId),
          isNotNull(MessageDispatchTable.values),
          isNull(MessageDispatchTable.deleted_at),
        ),
      )
      .for("update");
    return rows.map((row) => ({
      id: row.id,
      actor_id: row.actor_id ?? null,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      values: row.values as Record<string, unknown>,
    }));
  },
  async updateDispatchImages(tx, dispatchId, patch) {
    await tx
      .update(MessageDispatchTable)
      .set({ values: patch.values, metadata: patch.metadata, updatedAt: new Date() })
      .where(eq(MessageDispatchTable.id, dispatchId));
  },
  async update(tx, id, patch) {
    const [row] = await tx
      .update(MessageTemplateTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(MessageTemplateTable.id, id))
      .returning();
    return row;
  },
  async latestVersion(id, tx) {
    const [row] = await (tx ?? db)
      .select()
      .from(MessageTemplateVersionTable)
      .where(eq(MessageTemplateVersionTable.template_id, id))
      .orderBy(desc(MessageTemplateVersionTable.version))
      .limit(1);
    return row ?? null;
  },
  async insertVersion(tx, values) {
    const [row] = await tx.insert(MessageTemplateVersionTable).values(values).returning();
    return row;
  },
  async listVersions(id) {
    return db
      .select()
      .from(MessageTemplateVersionTable)
      .where(eq(MessageTemplateVersionTable.template_id, id))
      .orderBy(desc(MessageTemplateVersionTable.version));
  },
  async findVersion(id, version) {
    const [row] = await db
      .select()
      .from(MessageTemplateVersionTable)
      .where(and(eq(MessageTemplateVersionTable.template_id, id), eq(MessageTemplateVersionTable.version, version)))
      .limit(1);
    return row ?? null;
  },
};
