// src/features/core/messaging/services/server/preferences/types.ts

import type { DbTransaction } from "@/lib/crud/drizzle/types";

/** 好みの行(止めた時だけある) */
export type MessagePreferenceRow = { category: string; channel: string };

/** 好みの表の DB の読み書き(テストは偽物を渡す) */
export type MessagePreferenceStore = {
  listOwn: (userId: string) => Promise<MessagePreferenceRow[]>;
  /** 行を足す(既にあれば何もしない) */
  add: (values: { userId: string; category: string; channel: string; source: string }) => Promise<void>;
  /** 本人のその行を消す(無ければ何もしない) */
  remove: (userId: string, category: string, channel: string) => Promise<void>;
  deleteAllOfUser: (userId: string, tx: DbTransaction) => Promise<void>;
};
