// src/features/core/messaging/services/server/inbox/dto.ts
//
// 受け取り箱の 1 行(利用者へ返す形)。回の中身(宛先・数・記録)と他人の情報は入れない。
// 一覧は要約の列だけ(題・本文 = 短い本文か本文・行き先・画像)。詳細はひな形と欄の中身も(InboxItemDetailDto)。
// image は保存した値のまま(storage:// の ref か URL)。表示の部品が lib/storage の toStorageDisplaySrc で表示用にする

import type { MessageLayoutFields } from "@/lib/messaging";

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

/**
 * 詳細(GET /api/me/messaging/inbox/[id]、指令 60、D121・D115): 一覧の形 + ひな形の鍵・今の版・欄の中身(今の版へ読み替え済み)・
 * お知らせの経路の欄の宣言(fieldsForChannel(layout, "inApp")、汎用の描き方が型を知る)。
 * 前の行・記録の段が meta の行・ひな形が無い / 版が読めない行は 4 つとも無い = 要約のカードで描く
 */
export type InboxItemDetailDto = InboxItemDto & {
  layout?: string;
  layoutVersion?: number;
  values?: Record<string, unknown>;
  fields?: MessageLayoutFields;
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
