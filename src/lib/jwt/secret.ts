// src/lib/jwt/secret.ts

const encoder = new TextEncoder();
let cachedSecret: Uint8Array | null = null;

/**
 * JWT 署名鍵を環境変数から取得し、Uint8Array へ変換する。
 * 未設定の場合は明確なエラーを投げる。
 */
export const getAuthJwtSecret = (): Uint8Array => {
  if (cachedSecret) {
    return cachedSecret;
  }

  const secret = process.env.AUTH_JWT_SECRET;

  if (!secret || secret.trim().length === 0) {
    throw new Error("AUTH_JWT_SECRET が設定されていません");
  }

  cachedSecret = encoder.encode(secret);
  return cachedSecret;
};
