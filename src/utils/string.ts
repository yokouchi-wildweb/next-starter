import { randomBytes, scrypt as nodeScrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(nodeScrypt);

/**
 * 任意の文字列を scrypt でハッシュ化し、salt とセットで返す。
 */
export async function createHash(value: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buffer = (await scryptAsync(value, salt, 64)) as Buffer;
  return `${salt}:${buffer.toString("hex")}`;
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
