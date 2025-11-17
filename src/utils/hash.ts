
import { randomBytes, scrypt as nodeScrypt } from "crypto";
import { promisify } from "util";

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
 * createHash を nullish な入力へ対応させるためのラッパー。
 * undefined を維持しつつ、null または空文字の場合は null を返す。
 */
export async function createHashPreservingNullish(
  value: string | null | undefined,
): Promise<string | null | undefined> {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (value.length === 0) {
    return null;
  }

  return await createHash(value);
}
