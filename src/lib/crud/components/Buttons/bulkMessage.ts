// src/lib/crud/components/Buttons/bulkMessage.ts
// 一括ボタン(Bulk*Button)の確かめ・成功の文の {count} を件数に置き換える(4 つのボタンで 1 つ)。

/** メッセージ内の {count} プレースホルダーを件数に置換 */
export const formatMessage = (message: string, count: number): string => message.replace(/\{count\}/g, String(count));
