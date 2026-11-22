// src/domains/core/messaging/services/server/preferences/groupRows.ts
//
// グループまるごとの停止の行(D123)の書き方と、連絡のカテゴリーに当たる好みの行の category の値。
// - グループの行 = message_preferences の category に 'group:<グループの鍵>'(kind '*'、channel = 送信チャンネルか '*')。列は足さない
//   (カテゴリーの鍵は camelCase のファイル名で ':' を含まないので、カテゴリーの行と重ならない)
// - 当たるかは送る時・読む時にカテゴリーの受け口の group で決める → 後からグループに入れたカテゴリーも止まる、外したカテゴリーは止まらない
// - 送る口(sendMessage/stops.ts → store.findOptOuts)・お知らせの見え方(inbox/visibility.ts)・好みの service が同じこの関数を使う

import type { MessageCategory } from "@/lib/messaging";

import { MESSAGE_ALL } from "../../../entities/schema";

/** グループの行の category の頭 */
export const GROUP_ROW_PREFIX = "group:";

/** グループの鍵 → 行の category の値 */
export function groupRowCategory(groupKey: string): string {
  return `${GROUP_ROW_PREFIX}${groupKey}`;
}

/** 行の category がグループの行か */
export function isGroupRowCategory(category: string): boolean {
  return category.startsWith(GROUP_ROW_PREFIX);
}

/** カテゴリーが入っているグループの行の category の値(グループに入っていなければ null) */
export function groupRowOfCategory(
  categories: Readonly<Record<string, Pick<MessageCategory, "group">>>,
  categoryKey: string,
): string | null {
  const group = categories[categoryKey]?.group;
  return group ? groupRowCategory(group) : null;
}

/** 連絡のカテゴリーに当たる好みの行の category の値: そのカテゴリー・全部 '*'・入っているグループの行 */
export function preferenceCategoryKeys(
  categories: Readonly<Record<string, Pick<MessageCategory, "group">>>,
  categoryKey: string,
): string[] {
  const group = groupRowOfCategory(categories, categoryKey);
  return group ? [categoryKey, MESSAGE_ALL, group] : [categoryKey, MESSAGE_ALL];
}
