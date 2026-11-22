// src/lib/messaging/layout/summary.ts
//
// 要約の題(D211): 件名を省いた送信(メールを送らない時)のお知らせの題を本文の頭から作る。上流のレイアウトの summary が使い、fork のレイアウトも同じ形にできる

/** 本文の頭から作る題の長さ(文字数。超えたら切って「…」) */
export const SUMMARY_TITLE_MAX = 40;

/** 要約の題 = 件名(空白だけでない時)、無ければ本文の最初の空でない行を SUMMARY_TITLE_MAX 文字で切り「…」 */
export function summaryTitle(subject: string | null | undefined, body: string | null | undefined): string {
  if (subject && subject.trim() !== "") return subject;
  const line = (body ?? "").split(/\r?\n/).map((text) => text.trim()).find((text) => text !== "") ?? "";
  const chars = Array.from(line);
  return chars.length > SUMMARY_TITLE_MAX ? `${chars.slice(0, SUMMARY_TITLE_MAX).join("")}…` : line;
}
