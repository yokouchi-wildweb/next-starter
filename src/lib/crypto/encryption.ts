// src/lib/crypto/encryption.ts

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * 暗号化に使用するアルゴリズムとパラメータ。
 * AES-256-GCM: 認証付き暗号化（機密性 + 完全性を保証）。
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM 推奨 IV 長
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // AES-256 = 256bit = 32bytes

/** 現在の暗号化バージョン。将来のアルゴリズム変更時に移行を可能にする。 */
const CURRENT_VERSION = "v1";

/**
 * 環境変数から暗号化キーを取得する。
 * キーは 32バイト（64文字の hex 文字列）である必要がある。
 */
function getEncryptionKey(key?: string): Buffer {
  const raw = key ?? process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "暗号化キーが指定されていません。環境変数 ENCRYPTION_KEY を設定するか、引数で渡してください",
    );
  }

  // hex 文字列（64文字 = 32バイト）の場合
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  // UTF-8 文字列（ちょうど32バイト）の場合
  const buf = Buffer.from(raw, "utf-8");
  if (buf.length !== KEY_LENGTH) {
    throw new Error(
      `暗号化キーは ${KEY_LENGTH} バイト（hex で ${KEY_LENGTH * 2} 文字）である必要があります。現在: ${buf.length} バイト`,
    );
  }

  return buf;
}

/**
 * 平文を AES-256-GCM で暗号化する。
 * 戻り値: "v1:iv:authTag:ciphertext"（全て hex エンコード）
 *
 * @param plaintext - 暗号化する平文
 * @param key - 暗号化キー（省略時は ENCRYPTION_KEY 環境変数）
 */
export function encrypt(plaintext: string, key?: string): string {
  const keyBuffer = getEncryptionKey(key);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    CURRENT_VERSION,
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * AES-256-GCM で暗号化された文字列を復号する。
 * 入力: "v1:iv:authTag:ciphertext"（encrypt の戻り値）
 *
 * @param encrypted - 暗号化された文字列
 * @param key - 暗号化キー（省略時は ENCRYPTION_KEY 環境変数）
 * @throws 復号に失敗した場合（改ざん検知含む）
 */
export function decrypt(encrypted: string, key?: string): string {
  const parts = encrypted.split(":");

  if (parts.length !== 4) {
    throw new Error("暗号化データの形式が不正です");
  }

  const [version, ivHex, authTagHex, ciphertextHex] = parts;

  if (version !== "v1") {
    throw new Error(`未対応の暗号化バージョンです: ${version}`);
  }

  const keyBuffer = getEncryptionKey(key);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf-8");
}

/**
 * 暗号化キーとして使用可能なランダムな hex 文字列を生成する。
 * セットアップ時に 1回 呼んで ENCRYPTION_KEY に設定する用途。
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LENGTH).toString("hex");
}
