// src/features/core/messaging/services/server/inbox/dto.ts
//
// 受け取り箱の 1 行(利用者へ返す形)。回の中身(宛先・数・記録)と他人の情報は入れない。
// image は保存した値のまま(storage:// の ref か URL)。表示の部品が lib/storage の toStorageDisplaySrc で表示用にする

export type InboxItemDto = {
  id: string;
  title: string | null;
  body: string;
  link: string | null;
  image: string | null;
  metadata: Record<string, unknown> | null;
  /** 公開の時刻(ISO) */
  publishedAt: string;
  read: boolean;
};

export type InboxPage = { items: InboxItemDto[]; nextCursor: string | null };

/** 一覧の印(公開の時刻と id の keyset)。中身は見せない */
export function encodeInboxCursor(publishedAt: Date, id: string): string {
  return Buffer.from(`${publishedAt.toISOString()}|${id}`, "utf8").toString("base64url");
}

export function decodeInboxCursor(cursor: string | null | undefined): { publishedAt: Date; id: string } | null {
  if (!cursor) return null;
  const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const publishedAt = new Date(iso ?? "");
  if (!id || Number.isNaN(publishedAt.getTime())) return null;
  return { publishedAt, id };
}
