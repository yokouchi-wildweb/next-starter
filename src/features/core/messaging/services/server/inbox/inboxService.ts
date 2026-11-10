// src/features/core/messaging/services/server/inbox/inboxService.ts
//
// 受け取り箱の利用者の service(D18・D32)。見える行の規則は visibility.ts、既読の判定は readState.ts。

import { DomainError } from "@/lib/errors";

import { decodeInboxCursor, encodeInboxCursor, type InboxItemDto, type InboxPage } from "./dto";
import type { InboxRow, InboxStore } from "./types";
import type { InboxViewer } from "./visibility";

export const INBOX_DEFAULT_LIMIT = 20;
export const INBOX_MAX_LIMIT = 50;

function toDto(row: InboxRow): InboxItemDto {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    link: row.link,
    image: row.image,
    metadata: row.metadata,
    publishedAt: row.publishedAt.toISOString(),
    read: row.read,
  };
}

export function createInboxService(store: InboxStore) {
  return {
    /**
     * 一覧(公開の時刻・id の降順の keyset)。
     * @throws DomainError(400) cursor の形が正しくない
     */
    async listInbox(
      viewer: InboxViewer,
      params: { cursor?: string | null; limit?: number; unreadOnly?: boolean } = {},
    ): Promise<InboxPage> {
      const before = params.cursor ? decodeInboxCursor(params.cursor) : null;
      if (params.cursor && !before) throw new DomainError("cursor が正しくありません", { status: 400 });
      const limit = Math.min(Math.max(Math.trunc(params.limit ?? INBOX_DEFAULT_LIMIT), 1), INBOX_MAX_LIMIT);
      const rows = await store.list(viewer, { before, limit: limit + 1, unreadOnly: Boolean(params.unreadOnly) });
      const page = rows.slice(0, limit);
      const last = page[page.length - 1];
      return {
        items: page.map(toDto),
        nextCursor: rows.length > limit && last ? encodeInboxCursor(last.publishedAt, last.id) : null,
      };
    },

    /** 未読の数 */
    inboxUnreadCount(viewer: InboxViewer): Promise<number> {
      return store.countUnread(viewer);
    },

    /**
     * 1 件を既読にする(見える行だけ)。
     * @throws DomainError(404) 見えない行(他人の行・まだ公開していない行・無い行)
     */
    async markInboxRead(viewer: InboxViewer, itemId: string): Promise<void> {
      if (!(await store.isVisible(viewer, itemId))) {
        throw new DomainError("お知らせが見つかりません", { status: 404 });
      }
      await store.addRead(viewer.userId, itemId);
    },

    /** 全部既読(watermark を今に進め、自分の個別の既読の行を掃く) */
    markAllInboxRead(viewer: InboxViewer): Promise<void> {
      return store.markAllRead(viewer.userId);
    },
  };
}

export type InboxService = ReturnType<typeof createInboxService>;
