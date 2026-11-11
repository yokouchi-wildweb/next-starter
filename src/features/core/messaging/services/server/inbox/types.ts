// src/features/core/messaging/services/server/inbox/types.ts

import type { InboxViewer } from "./visibility";

/** 見える行 1 つ(既読つき) */
export type InboxRow = {
  id: string;
  title: string | null;
  body: string;
  link: string | null;
  image: string | null;
  metadata: Record<string, unknown> | null;
  publishedAt: Date;
  read: boolean;
};

/** 受け取り箱の DB の読み書き(見える行の規則は実装が visibility の規則で守る。テストはメモリの偽物) */
export type InboxStore = {
  /** 見える行を公開の時刻・id の降順で(before より後ろ、limit 件まで。unreadOnly は静かな行 metadata.silent を除く) */
  list: (
    viewer: InboxViewer,
    params: { before: { publishedAt: Date; id: string } | null; limit: number; unreadOnly: boolean },
  ) => Promise<InboxRow[]>;
  /** 未読の数(静かな行 metadata.silent は数えない) */
  countUnread: (viewer: InboxViewer) => Promise<number>;
  isVisible: (viewer: InboxViewer, itemId: string) => Promise<boolean>;
  /** 個別の既読の行を足す(既にあれば何もしない) */
  addRead: (userId: string, itemId: string) => Promise<void>;
  /** watermark を今に進め、公開の時刻 ≤ 今の自分の既読の行を掃く(1 つの取引) */
  markAllRead: (userId: string) => Promise<void>;
};
