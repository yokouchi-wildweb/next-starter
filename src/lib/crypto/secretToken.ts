// src/lib/crypto/secretToken.ts
//
// DB 照合用のランダムトークンと、人が読み書きする短いコードの生成・ハッシュ化。
// 「生の値はクライアントに 1 回だけ渡し、DB にはハッシュだけ保存する」用途向け
// (端末トークン・ワンタイムコード・招待トークン等)。server-only。

import { createHash, randomBytes, randomInt } from "node:crypto";

/**
 * 推測不能なランダムトークンを生成する (base64url)。
 * 既定 32 バイト = 256 bit。Cookie 値や URL にそのまま載せられる。
 */
export function generateSecretToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * トークン・コードを DB 保存用にハッシュ化する (SHA-256 hex)。
 * 十分なエントロピーを持つランダム値の照合用。パスワードには使わない (src/utils/hash.ts の scrypt を使う)。
 */
export function hashSecretToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * 短いコードの文字集合 (Crockford Base32)。
 * 読み間違えやすい I / L / O / U を含まない。1 文字 = 5 bit。
 */
export const SHORT_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * 人が目で読んで入力する短いコードを生成する (大文字の Crockford Base32)。
 * 既定 8 文字 = 40 bit。総当たりへの耐性は有効期限とレート制限で補うこと。
 */
export function generateShortCode(length = 8): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += SHORT_CODE_ALPHABET[randomInt(SHORT_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * 入力されたコードを正規化する。
 * - 空白とハイフンを除去し大文字化する
 * - 読み間違えやすい文字を寄せる (I / L → 1、O → 0)
 * - 文字集合外の文字を含む場合は null
 */
export function normalizeShortCode(input: string): string | null {
  const normalized = input
    .replace(/[\s-]/g, "")
    .toUpperCase()
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
  if (normalized.length === 0) return null;
  for (const char of normalized) {
    if (!SHORT_CODE_ALPHABET.includes(char)) return null;
  }
  return normalized;
}

/**
 * 表示用にコードを区切る (例: "ABCD2345" → "ABCD-2345")。
 * normalizeShortCode はハイフンを除去するので、表示形のまま入力されても照合できる。
 */
export function formatShortCode(code: string, groupSize = 4): string {
  const groups: string[] = [];
  for (let i = 0; i < code.length; i += groupSize) {
    groups.push(code.slice(i, i + groupSize));
  }
  return groups.join("-");
}
