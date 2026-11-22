// src/domains/core/messaging/services/server/dispatchId.ts
//
// 送信の id の形。送信の id の列は uuid なので、形の合わない字(古い住所 /admin/messaging/send の "send"、打ち間違い)を
// そのまま渡すと Postgres が「invalid input syntax for type uuid」で落ち、口は 500 を返す。
// 送信を id で引く store は、形の合わない id を「その送信は無い」と同じに扱う(読まずに null / 空)→ 呼び手の 404 の道に乗る。
// 字面だけを見る(版と variant は見ない: 旧お知らせの写しの id は md5 から作った uuid で RFC の variant に従わない)

const UUID_TEXT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** uuid の列に渡せる字面か(送信・配達の id) */
export function isDispatchId(id: string): boolean {
  return UUID_TEXT.test(id);
}
