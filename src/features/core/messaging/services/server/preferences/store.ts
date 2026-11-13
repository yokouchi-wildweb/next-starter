// src/features/core/messaging/services/server/preferences/store.ts

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { MessagePreferenceTable } from "../../../entities/preference";
import { MESSAGE_ALL } from "../../../entities/schema";
import type { MessagePreferenceStore } from "./types";

const P = MessagePreferenceTable;

/** 一意の 4 列(素の列の uniqueIndex。entities/preference.ts) */
export const MESSAGE_PREFERENCE_CONFLICT_TARGET = [P.user_id, P.category, P.channel, P.kind];

// 表の kind は NOT NULL で '*' = 種別まるごとではない。service と偽物の行は null で持つ(読み替えはこの store だけ)
const toColumn = (kind: string | null | undefined): string => kind ?? MESSAGE_ALL;
const fromColumn = (kind: string): string | null => (kind === MESSAGE_ALL ? null : kind);

export const drizzleMessagePreferenceStore: MessagePreferenceStore = {
  async listOwn(userId) {
    const rows = await db
      .select({ category: P.category, channel: P.channel, kind: P.kind })
      .from(P)
      .where(eq(P.user_id, userId));
    return rows.map((row) => ({ ...row, kind: fromColumn(row.kind) }));
  },
  async write(userId, { remove = [], add = [] }) {
    if (remove.length === 0 && add.length === 0) return;
    await db.transaction(async (tx) => {
      for (const key of remove) {
        await tx
          .delete(P)
          .where(and(eq(P.user_id, userId), eq(P.category, key.category), eq(P.channel, key.channel), eq(P.kind, toColumn(key.kind))));
      }
      if (add.length > 0) {
        await tx
          .insert(P)
          .values(add.map((row) => ({ user_id: userId, category: row.category, channel: row.channel, kind: toColumn(row.kind), source: row.source })))
          .onConflictDoNothing({ target: MESSAGE_PREFERENCE_CONFLICT_TARGET });
      }
    });
  },
  async deleteAllOfUser(userId, tx) {
    await tx.delete(P).where(eq(P.user_id, userId));
  },
};
