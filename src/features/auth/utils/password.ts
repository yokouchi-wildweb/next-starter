// src/features/auth/utils/password.ts

import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const SCRYPT_KEY_LENGTH = 64;
const SALT_LENGTH = 16;

const scrypt = promisify(nodeScrypt);

export type HashPasswordOptions = {
  salt?: string;
};

/**
 * パスワードを scrypt でハッシュ化する。
 */
export const hashPassword = async (
  password: string,
  options: HashPasswordOptions = {},
): Promise<string> => {
  const salt = options.salt ?? randomBytes(SALT_LENGTH).toString("hex");
  const derivedKey = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
};

/**
 * ハッシュ化済みパスワードと平文パスワードを照合する。
 */
export const verifyPassword = async (
  password: string,
  hashedPassword: string | null | undefined,
): Promise<boolean> => {
  if (!hashedPassword) {
    return false;
  }

  const [salt, storedKey] = hashedPassword.split(":");
  if (!salt || !storedKey) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  const storedKeyBuffer = Buffer.from(storedKey, "hex");

  if (derivedKey.length !== storedKeyBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedKeyBuffer);
};
