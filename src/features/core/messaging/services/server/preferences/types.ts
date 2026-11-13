// src/features/core/messaging/services/server/preferences/types.ts

import type { DbTransaction } from "@/lib/crud/drizzle/types";

/** 好みの行(止めた時だけある)。kind のある行 = 種別まるごとの停止(category・channel は '*') */
export type MessagePreferenceRow = { category: string; channel: string; kind: string | null };

/** 足す行(kind 省略 = null) */
export type MessagePreferenceAdd = { category: string; channel: string; kind?: string | null; source: string };

/** 消す行(kind 省略 = null の行) */
export type MessagePreferenceKey = { category: string; channel: string; kind?: string | null };

/** 好みの表の DB の読み書き(テストは偽物を渡す) */
export type MessagePreferenceStore = {
  listOwn: (userId: string) => Promise<MessagePreferenceRow[]>;
  /**
   * 本人の行を消して足す(1 つの transaction。消すのが先)。足す行が既にあれば何もしない、消す行が無ければ何もしない
   */
  write: (userId: string, change: { remove?: readonly MessagePreferenceKey[]; add?: readonly MessagePreferenceAdd[] }) => Promise<void>;
  deleteAllOfUser: (userId: string, tx: DbTransaction) => Promise<void>;
};
