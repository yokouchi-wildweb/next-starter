"use client";

// src/domains/core/messaging/hooks/useIdempotencyKey.ts
//
// 二重送信を防ぐ鍵(公開の部品、D191): 送る画面を開いた時に 1 つ、送るのに成功したら作り直す(renew)。
// 同じ鍵の 2 回目の送信はサーバーが 409 で断る(.claude/rules/items/domains/messaging.md idempotency)。
// 鍵を作る関数はこのフォルダの中だけ(newIdempotencyKey は入口から出さない。鍵の持ち方を呼び手ごとに作らせない)

import { useCallback, useState } from "react";

import { newIdempotencyKey } from "./idempotencyKey";

export function useIdempotencyKey() {
  const [key, setKey] = useState(newIdempotencyKey);
  /** 新しい鍵にする(開いた時・送るのに成功した時) */
  const renew = useCallback(() => setKey(newIdempotencyKey()), []);
  return { key, renew };
}
