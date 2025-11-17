/**
 * 空文字列を null へ正規化し、文字列はトリムして返す。
 * nullish 以外の値はそのまま返却する。
 */
export function emptyToNull(
  value: unknown,
): string | null | undefined {
  if (value === undefined || value === null) {
    return value as undefined | null;
  }

  if (typeof value !== "string") {
    return value as string | null | undefined;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  return trimmed;
}

/**
 * 日本語テキストを指定した最大文字数でカットし、末尾に任意の文字列を付加する関数
 *
 * @param text - 対象のテキスト
 * @param maxLength - 最大文字数（デフォルトは20文字）
 * @param suffix - 末尾に付加する文字列（デフォルトは "…"）
 * @returns 指定文字数以内ならそのまま、超えていれば切り取って suffix を追加した文字列
 *
 * 例：
 * truncateJapanese("これはとても長い文章です。") // => "これはとても長い文章で…"
 * truncateJapanese("これはとても長い文章です。", 10, "…続きを読む") // => "これはとても長…続きを読む"
 */
export function truncateJapanese(
  text: string,
  maxLength: number = 20,
  suffix: string = "…",
): string {
  return text.length > maxLength ? text.slice(0, maxLength) + suffix : text;
}
