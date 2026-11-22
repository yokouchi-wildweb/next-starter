/**
 * ウォレット関連の共通フォーマット関数
 */

/**
 * 日付を日本語形式でフォーマット
 * @param value Date | string | null | undefined
 * @returns フォーマット済み日付文字列または "-"
 */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

/**
 * 数値を3桁区切りでフォーマット
 * @param value number | null | undefined
 * @returns フォーマット済み数値文字列または "-"
 */
export function formatNumber(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "-";
  }
  return value.toLocaleString();
}

/**
 * 残高を3桁区切りでフォーマット（formatNumberのエイリアス）
 * @param balance number | null | undefined
 * @returns フォーマット済み残高文字列または "-"
 */
export function formatBalance(balance: number | null | undefined): string {
  return formatNumber(balance);
}

/**
 * メタ情報の値をフォーマット
 * @param value unknown
 * @returns フォーマット済み文字列
 */
export function formatMetaValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
