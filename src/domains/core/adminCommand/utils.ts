// src/lib/adminCommand/utils.ts

/**
 * 全角英数字を半角に変換
 */
function toHalfWidth(str: string): string {
  return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );
}

/**
 * 検索入力を半角英数字のみにフィルタリング
 * - 全角英数字は半角に変換
 * - 半角英数字とスペース以外は除去
 */
export function filterSearchInput(value: string): string {
  const halfWidth = toHalfWidth(value);
  return halfWidth.replace(/[^a-zA-Z0-9\s]/g, "");
}
