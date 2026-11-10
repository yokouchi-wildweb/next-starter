// src/features/core/messaging/services/server/unsubscribe/store.ts

import { eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { UserTable } from "@/features/core/user/entities/drizzle";

import { MessagePreferenceTable, MessageSuppressionTable } from "../../../entities/preference";
import type { OneClickStore } from "./recordOneClick";

export const drizzleOneClickStore: OneClickStore = {
  async addPreference({ userId, category, channel, source }) {
    const [user] = await db.select({ id: UserTable.id }).from(UserTable).where(eq(UserTable.id, userId)).limit(1);
    if (!user) return false;
    await db
      .insert(MessagePreferenceTable)
      .values({ user_id: userId, category, channel, source })
      .onConflictDoNothing({
        target: [MessagePreferenceTable.user_id, MessagePreferenceTable.category, MessagePreferenceTable.channel],
      });
    return true;
  },
  async addSuppression({ channel, addressHash, scope, source }) {
    await db
      .insert(MessageSuppressionTable)
      .values({ channel, address_hash: addressHash, reason: "one_click", scope, source })
      .onConflictDoNothing({
        target: [MessageSuppressionTable.channel, MessageSuppressionTable.address_hash, MessageSuppressionTable.scope],
      });
  },
};
