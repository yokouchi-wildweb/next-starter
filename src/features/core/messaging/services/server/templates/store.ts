// src/features/core/messaging/services/server/templates/store.ts

import { and, desc, eq, lt, or } from "drizzle-orm";

import { db, type TransactionClient } from "@/lib/drizzle";

import { MessageTemplateTable, MessageTemplateVersionTable } from "../../../entities/template";
import type { MessageTemplateStore } from "./types";

export const drizzleMessageTemplateStore: MessageTemplateStore<TransactionClient> = {
  transaction: (run) => db.transaction((tx) => run(tx)),
  async list({ status, limit, after }) {
    const conditions = [
      status ? eq(MessageTemplateTable.status, status) : undefined,
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
