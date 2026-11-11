// src/lib/line/retryKey.ts
//
// X-Line-Retry-Key(push 等の送り直しで二重に送らないための鍵)を呼び手の鍵から決まった形で作る。
// LINE は UUID の形の鍵を求めるので、固定の名前空間 + 呼び手の鍵の UUID v5(sha1)にする。
// 同じ鍵 → いつも同じ UUID(送り直しでも同じ鍵が付き、LINE が受付済みなら 409 で返す)。

import { createHash } from "node:crypto";

/** この lib の名前空間(固定。変えると既に送った鍵と合わなくなる) */
const LINE_RETRY_KEY_NAMESPACE = "f9631025-d669-4a29-9c31-b2512017cebe";

function uuidBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

/**
 * 呼び手の鍵(例: 配達の id)から X-Line-Retry-Key の UUID を作る。
 * @param seed 送り直しの間で変わらない鍵(空文字は不可)
 */
export function lineRetryKey(seed: string): string {
  if (seed.length === 0) throw new Error("lineRetryKey: 鍵が空です");
  const hash = createHash("sha1")
    .update(uuidBytes(LINE_RETRY_KEY_NAMESPACE))
    .update(seed, "utf8")
    .digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC 4122
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
