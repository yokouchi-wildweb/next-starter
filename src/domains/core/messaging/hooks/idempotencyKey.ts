// src/domains/core/messaging/hooks/idempotencyKey.ts
//
// 二重送信を防ぐ鍵を作る(このフォルダの中だけ: useIdempotencyKey・useSendTest が使う。hooks/index.ts から出さない、D191)

export const newIdempotencyKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
