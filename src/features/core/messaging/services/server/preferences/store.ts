// src/features/core/messaging/services/server/preferences/store.ts

import { and, eq, isNull, type SQL } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { MessagePreferenceTable } from "../../../entities/preference";
import type { MessagePreferenceStore } from "./types";

const P = MessagePreferenceTable;

/** 一意の 4 列(kind の NULL は同じと見る。entities/preference.ts) */
export const MESSAGE_PREFERENCE_CONFLICT_TARGET = [P.user_id, P.category, P.channel, P.kind];

const kindIs = (kind: string | null | undefined): SQL => (kind ? eq(P.kind, kind) : isNull(P.kind));

export const drizzleMessagePreferenceStore: MessagePreferenceStore = {
  async listOwn(userId) {
    return db
      .select({ category: P.category, channel: P.channel, kind: P.kind })
      .from(P)
      .where(eq(P.user_id, userId));
  },
  async write(userId, { remove = [], add = [] }) {
    if (remove.length === 0 && add.length === 0) return;
    await db.transaction(async (tx) => {
      for (const key of remove) {
        await tx
          .delete(P)
          .where(and(eq(P.user_id, userId), eq(P.category, key.category), eq(P.channel, key.channel), kindIs(key.kind)));
      }
      if (add.length > 0) {
        await tx
          .insert(P)
          .values(add.map((row) => ({ user_id: userId, category: row.category, channel: row.channel, kind: row.kind ?? null, source: row.source })))
          .onConflictDoNothing({ target: MESSAGE_PREFERENCE_CONFLICT_TARGET });
      }
    });
  },
  async deleteAllOfUser(userId, tx) {
    await tx.delete(P).where(eq(P.user_id, userId));
  },
};
