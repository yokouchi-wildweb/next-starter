// src/features/core/messaging/services/server/preferences/store.ts

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { MessagePreferenceTable } from "../../../entities/preference";
import type { MessagePreferenceStore } from "./types";

export const drizzleMessagePreferenceStore: MessagePreferenceStore = {
  async listOwn(userId) {
    return db
      .select({ category: MessagePreferenceTable.category, channel: MessagePreferenceTable.channel })
      .from(MessagePreferenceTable)
      .where(eq(MessagePreferenceTable.user_id, userId));
  },
  async add({ userId, category, channel, source }) {
    await db
      .insert(MessagePreferenceTable)
      .values({ user_id: userId, category, channel, source })
      .onConflictDoNothing({
        target: [MessagePreferenceTable.user_id, MessagePreferenceTable.category, MessagePreferenceTable.channel],
      });
  },
  async remove(userId, category, channel) {
    await db
      .delete(MessagePreferenceTable)
      .where(
        and(
          eq(MessagePreferenceTable.user_id, userId),
          eq(MessagePreferenceTable.category, category),
          eq(MessagePreferenceTable.channel, channel),
        ),
      );
  },
  async deleteAllOfUser(userId, tx) {
    await tx.delete(MessagePreferenceTable).where(eq(MessagePreferenceTable.user_id, userId));
  },
};
