// src/lib/storage/client/privateMediaRecovery.test.ts
// usePrivateMediaRecovery の先回り再読み込みの判定（isSignedReadStale）と再取得 query の単体テスト。
// 要素への配線（loadstart / play / seeking）はブラウザで確かめる。
// 実行: pnpm test:storage-client

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { STORAGE_CONFIG } from "@/config/app/storage.config";

import { isSignedReadStale, PROACTIVE_RELOAD_MARGIN_SEC, withMediaRetryQuery } from "./usePrivateMediaRecovery";

describe("先回り再読み込みの判定", () => {
  const ttl = STORAGE_CONFIG.readTtlSec.video;
  const start = 1_000_000;

  test("読み込み開始から TTL − 30 秒に届かなければ読み直さない", () => {
    assert.equal(isSignedReadStale(start, start + (ttl - PROACTIVE_RELOAD_MARGIN_SEC) * 1000 - 1, ttl), false);
  });

  test("TTL − 30 秒以降（期限後も）は読み直す", () => {
    assert.equal(isSignedReadStale(start, start + (ttl - PROACTIVE_RELOAD_MARGIN_SEC) * 1000, ttl), true);
    assert.equal(isSignedReadStale(start, start + ttl * 1000 + 60_000, ttl), true);
  });

  test("読み込みが始まっていなければ読み直さない", () => {
    assert.equal(isSignedReadStale(null, start, ttl), false);
  });

  test("TTL が余白より短いときは開始直後から読み直す扱い（0 秒で打ち切り）", () => {
    assert.equal(isSignedReadStale(start, start, 20), true);
  });

  test("TTL 60 秒（S5 の試験値）なら 30 秒で読み直す", () => {
    assert.equal(isSignedReadStale(start, start + 29_999, 60), false);
    assert.equal(isSignedReadStale(start, start + 30_000, 60), true);
  });
});

test("再取得 query は既存の query を残して付け足す", () => {
  assert.equal(withMediaRetryQuery("/api/storage/objects/x", 1), "/api/storage/objects/x?_r=1");
  assert.equal(withMediaRetryQuery("/api/storage/objects/x?a=1", 2), "/api/storage/objects/x?a=1&_r=2");
});
