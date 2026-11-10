// src/features/core/messaging/services/server/endpoints/store.ts

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { MessageEndpointTable } from "../../../entities/endpoint";
import type { MessageEndpointStore } from "./types";

export const drizzleMessageEndpointStore: MessageEndpointStore = {
  async findByChannelAddress(channel, address) {
    const [row] = await db
      .select()
      .from(MessageEndpointTable)
      .where(and(eq(MessageEndpointTable.channel, channel), eq(MessageEndpointTable.address, address)))
      .limit(1);
    return row ?? null;
  },
  async insert(values) {
    const [row] = await db.insert(MessageEndpointTable).values(values).returning();
    return row;
  },
  async update(id, patch) {
    const [row] = await db.update(MessageEndpointTable).set(patch).where(eq(MessageEndpointTable.id, id)).returning();
    return row;
  },
  async deleteOwn(userId, id) {
    const rows = await db
      .delete(MessageEndpointTable)
      .where(and(eq(MessageEndpointTable.id, id), eq(MessageEndpointTable.user_id, userId)))
      .returning({ id: MessageEndpointTable.id });
    return rows.length > 0;
  },
  async listOwn(userId) {
    return db
      .select()
      .from(MessageEndpointTable)
      .where(eq(MessageEndpointTable.user_id, userId))
      .orderBy(desc(MessageEndpointTable.createdAt));
  },
  async deleteAllOfUser(userId, tx) {
    await tx.delete(MessageEndpointTable).where(eq(MessageEndpointTable.user_id, userId));
  },
};
