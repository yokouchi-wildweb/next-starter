// src/lib/storage/server/portValues.ts
//
// StoragePort の境界の値(実装 gcs.ts と port.ts の両方が読む。port.ts が再 export する)

import type { ObjectLocation } from "./port";

/** 発行直後のオブジェクトに付ける Cache-Control（固定） */
export const ISSUED_CACHE_CONTROL = "no-store";

/** read の対象が maxBytes を超えていた */
export class StorageReadTooLargeError extends Error {
  readonly size: number;
  readonly maxBytes: number;

  constructor(location: ObjectLocation, size: number, maxBytes: number) {
    super(`読み取りの上限を超えています（${size} > ${maxBytes}）: ${location.bucket}/${location.path}`);
    this.name = "StorageReadTooLargeError";
    this.size = size;
    this.maxBytes = maxBytes;
  }
}
